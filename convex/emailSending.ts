import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Initialize Resend only if API key is available
let resend: any = null;
try {
  if (process.env.CONVEX_RESEND_API_KEY) {
    console.log(
      "🔧 Initializing Resend with API key:",
      process.env.CONVEX_RESEND_API_KEY ? "Present" : "Missing",
    );
    const { Resend } = require("resend");
    resend = new Resend(process.env.CONVEX_RESEND_API_KEY);

    // Set base URL if provided (for Convex proxy)
    if (process.env.RESEND_BASE_URL) {
      console.log("🔧 Setting Resend base URL:", process.env.RESEND_BASE_URL);
      resend.baseURL = process.env.RESEND_BASE_URL;
    }
    console.log("✅ Resend initialized successfully");
  } else {
    console.warn("⚠️ CONVEX_RESEND_API_KEY not found in environment variables");
  }
} catch (error) {
  console.error("❌ Failed to initialize Resend:", error);
  console.warn("Resend not initialized - email functionality will be disabled");
}

// Send email with queued events for a subscription
export const sendSubscriptionEmail = action({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; message: string; eventsSent?: number }> => {
    console.log(
      "📧 Starting sendSubscriptionEmail for subscription:",
      args.subscriptionId,
    );
    const result = await ctx.runAction(
      internal.emailSending.sendSubscriptionEmailInternal,
      {
        subscriptionId: args.subscriptionId,
      },
    );
    console.log("📧 sendSubscriptionEmail result:", result);
    return result;
  },
});

export const sendSubscriptionEmailInternal = internalAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; message: string; eventsSent?: number }> => {
    console.log(
      "🔍 Starting sendSubscriptionEmailInternal for subscription:",
      args.subscriptionId,
    );

    try {
      if (!resend) {
        console.error(
          "❌ Resend not initialized - email service not configured",
        );
        return {
          success: false,
          message:
            "Email service not configured - CONVEX_RESEND_API_KEY environment variable is required",
        };
      }

      console.log("✅ Resend is initialized, proceeding with email send");

      // Get the subscription
      console.log("🔍 Fetching subscription data...");
      const subscription = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.getSubscriptionById,
        {
          subscriptionId: args.subscriptionId,
        },
      );

      if (!subscription) {
        console.error("❌ Subscription not found:", args.subscriptionId);
        return { success: false, message: "Subscription not found" };
      }

      console.log("✅ Subscription found:", {
        id: subscription._id,
        userId: subscription.userId,
        prompt: subscription.prompt,
        isActive: subscription.isActive,
      });

      // Get the user
      console.log("🔍 Fetching user data...");
      const user = await ctx.runQuery(internal.users.getUserById, {
        userId: subscription.userId,
      });

      if (!user || !user.email) {
        console.error("❌ User not found or no email address:", {
          userFound: !!user,
          hasEmail: user?.email ? "Yes" : "No",
          email: user?.email,
        });
        return {
          success: false,
          message: "User not found or no email address",
        };
      }

      console.log("✅ User found:", {
        id: user._id,
        email: user.email,
        name: user.name,
      });

      // Get queued events for this subscription
      console.log("🔍 Fetching queued events...");
      const queuedEvents = await ctx.runQuery(
        internal.emailQueue.getQueuedEventsForSubscription,
        {
          subscriptionId: args.subscriptionId,
          includeAlreadySent: false,
        },
      );

      console.log("📊 Queued events found:", {
        count: queuedEvents.length,
        events: queuedEvents.map((e: any) => ({
          eventId: e.eventId,
          eventTitle: e.event?.title,
          matchScore: e.matchScore,
          matchType: e.matchType,
          emailSent: e.emailSent,
        })),
      });

      if (queuedEvents.length === 0) {
        console.warn("⚠️ No events in queue to send");
        return { success: false, message: "No events in queue to send" };
      }

      // Generate email content
      console.log("📝 Generating email content...");
      const emailHtml = generateEmailHtml(subscription, queuedEvents, user);
      const emailSubject = `${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} matching "${subscription.prompt}"`;

      console.log("📧 Email details:", {
        to: user.email,
        subject: emailSubject,
        htmlLength: emailHtml.length,
        eventCount: queuedEvents.length,
      });

      // Send the email using Convex Resend proxy
      console.log("🚀 Sending email via Resend...");
      console.log("📧 Email payload:", {
        from: "EventFinder Notifications <notifications@eventfinder.com>",
        to: user.email,
        subject: emailSubject,
        htmlPreview: emailHtml.substring(0, 200) + "...",
      });

      const { data, error } = await resend.emails.send({
        from: "EventFinder Notifications <notifications@eventfinder.com>",
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
      });

      console.log("📧 Resend response:", {
        data,
        error,
        success: !error,
      });

      if (error) {
        console.error("❌ Failed to send email via Resend:", error);
        return {
          success: false,
          message: `Failed to send email: ${JSON.stringify(error)}`,
        };
      }

      console.log("✅ Email sent successfully via Resend, data:", data);

      // Mark all queued events as sent
      console.log("🔄 Marking events as sent...");
      await ctx.runMutation(internal.emailQueue.markEventsAsSent, {
        subscriptionId: args.subscriptionId,
        eventIds: queuedEvents.map((e: { eventId: any }) => e.eventId),
      });

      console.log("✅ Events marked as sent");

      // Update subscription's last email sent time
      console.log("🔄 Updating subscription email time...");
      await ctx.runMutation(internal.emailSending.updateSubscriptionEmailTime, {
        subscriptionId: args.subscriptionId,
      });

      console.log("✅ Subscription email time updated");

      const result = {
        success: true,
        message: `Email sent successfully to ${user.email}`,
        eventsSent: queuedEvents.length,
      };

      console.log("🎉 Email sending completed successfully:", result);
      return result;
    } catch (error) {
      console.error("💥 Error in sendSubscriptionEmailInternal:", error);
      console.error(
        "💥 Error stack:",
        error instanceof Error ? error.stack : "No stack trace",
      );
      return {
        success: false,
        message: `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

export const updateSubscriptionEmailTime = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<void> => {
    console.log(
      "🔄 Updating subscription email time for:",
      args.subscriptionId,
    );

    const now = Date.now();
    const subscription = await ctx.db.get(args.subscriptionId);

    if (!subscription) {
      console.error(
        "❌ Subscription not found when updating email time:",
        args.subscriptionId,
      );
      return;
    }

    const emailFrequency = subscription.emailFrequencyHours || 24;
    const nextEmailTime = now + emailFrequency * 60 * 60 * 1000;

    console.log("📅 Email time update details:", {
      subscriptionId: args.subscriptionId,
      currentTime: new Date(now).toISOString(),
      emailFrequencyHours: emailFrequency,
      nextEmailTime: new Date(nextEmailTime).toISOString(),
    });

    await ctx.db.patch(args.subscriptionId, {
      lastEmailSent: now,
      nextEmailScheduled: nextEmailTime,
    });

    console.log("✅ Subscription email time updated successfully");
  },
});

function generateEmailHtml(
  subscription: any,
  queuedEvents: any[],
  user: any,
): string {
  console.log("📝 Generating email HTML for:", {
    subscriptionPrompt: subscription.prompt,
    eventCount: queuedEvents.length,
    userEmail: user.email,
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "#10b981"; // green
    if (score >= 0.6) return "#f59e0b"; // yellow
    return "#ef4444"; // red
  };

  const eventCards = queuedEvents
    .map((queueItem) => {
      const event = queueItem.event;
      console.log("📝 Generating card for event:", {
        title: event.title,
        matchScore: queueItem.matchScore,
        matchType: queueItem.matchType,
      });

      return `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; background-color: #ffffff;">
        ${
          event.imageUrl
            ? `
          <img src="${event.imageUrl}" alt="${event.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 16px;">
        `
            : ""
        }
        
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <span style="background-color: ${getScoreColor(queueItem.matchScore)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
            Match: ${(queueItem.matchScore * 100).toFixed(0)}%
          </span>
          <span style="background-color: #6366f1; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
            ${queueItem.matchType === "semantic" ? "AI Match" : "Title Match"}
          </span>
        </div>
        
        <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #111827;">
          ${event.title}
        </h3>
        
        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">
          📅 ${formatDate(event.eventDate)}
        </p>
        
        <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.5;">
          ${event.description}
        </p>
        
        <a href="${event.url}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View Event Details
        </a>
      </div>
    `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Events Matching Your Interests</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="text-align: center; margin-bottom: 30px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
        <h1 style="margin: 0 0 10px 0; color: #1f2937; font-size: 24px;">
          🎉 New Events Found!
        </h1>
        <p style="margin: 0; color: #6b7280; font-size: 16px;">
          We found ${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} matching your subscription:
        </p>
        <p style="margin: 8px 0 0 0; color: #3b82f6; font-weight: 600; font-size: 16px;">
          "${subscription.prompt}"
        </p>
      </div>

      ${eventCards}

      <div style="margin-top: 30px; padding: 20px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
          You're receiving this because you subscribed to event notifications.
        </p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          To manage your subscriptions, visit your EventFinder dashboard.
        </p>
      </div>

    </body>
    </html>
  `;

  console.log("✅ Email HTML generated successfully, length:", html.length);
  return html;
}
