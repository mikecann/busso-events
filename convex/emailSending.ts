import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  isPromptSubscription,
  isAllEventsSubscription,
  AnySubscription,
  QueuedEventItem,
} from "./subscriptions/common";
import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

const resend = new Resend(process.env.RESEND_API_KEY);

// Send email with queued events for a subscription
export const sendSubscriptionEmail = action({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; message: string; eventsSent?: number }> => {
    console.log("📧 Sending subscription email for:", args.subscriptionId);

    const result = await ctx.runAction(
      internal.emailSending.sendSubscriptionEmailInternal,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    console.log("📧 Email send result:", {
      success: result.success,
      eventsSent: result.eventsSent,
    });
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
    console.log("🔍 Processing email for subscription:", args.subscriptionId);

    try {
      if (!resend) {
        console.error(
          "❌ Resend not initialized - email service not configured",
        );
        return {
          success: false,
          message:
            "Email service not configured - RESEND_API_KEY environment variable is required",
        };
      }

      // Get the subscription
      const subscription = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.getSubscriptionById,
        {
          subscriptionId: args.subscriptionId,
        },
      );

      if (!subscription) {
        console.error(
          `❌ Subscription with id '${args.subscriptionId}' not found`,
        );
        return {
          success: false,
          message: `Subscription with id '${args.subscriptionId}' not found`,
        };
      }

      console.log("✅ Subscription found:", {
        id: subscription._id,
        userId: subscription.userId,
        prompt: isPromptSubscription(subscription)
          ? subscription.prompt
          : "All events",
        isActive: subscription.isActive,
      });

      // Get the user
      const user = await ctx.runQuery(internal.users.getUserById, {
        userId: subscription.userId,
      });

      if (!user || !user.email) {
        console.error(
          `❌ User with id '${subscription.userId}' not found or has no email address`,
        );
        return {
          success: false,
          message: `User with id '${subscription.userId}' not found or has no email address`,
        };
      }

      // Get queued events for this subscription
      const queuedEvents: QueuedEventItem[] = await ctx.runQuery(
        internal.emailQueue.getQueuedEventsForSubscription,
        {
          subscriptionId: args.subscriptionId,
          includeAlreadySent: false,
        },
      );

      if (queuedEvents.length === 0) {
        console.warn(
          `⚠️ No events queued for subscription '${args.subscriptionId}'`,
        );
        return { success: false, message: "No events in queue to send" };
      }

      console.log(`📊 Found ${queuedEvents.length} queued events to send`);

      // Generate email content
      const emailHtml = generateEmailHtml(subscription, queuedEvents, user);
      const emailSubject = isPromptSubscription(subscription)
        ? `${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} matching "${subscription.prompt}"`
        : `${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} for you`;

      // Send the email using Resend
      const { data, error } = await resend.emails.send({
        from: "EventFinder Notifications <notifications@eventfinder.com>",
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
      });

      if (error) {
        console.error("❌ Failed to send email via Resend:", error);
        return {
          success: false,
          message: `Failed to send email to '${user.email}': ${JSON.stringify(error)}`,
        };
      }

      console.log(`✅ Email sent successfully to ${user.email}`);

      // Mark all queued events as sent
      await ctx.runMutation(internal.emailQueue.markEventsAsSent, {
        subscriptionId: args.subscriptionId,
        eventIds: queuedEvents.map((e) => e.eventId),
      });

      // Update subscription's last email sent time
      await ctx.runMutation(internal.emailSending.updateSubscriptionEmailTime, {
        subscriptionId: args.subscriptionId,
      });

      return {
        success: true,
        message: `Email sent successfully to ${user.email}`,
        eventsSent: queuedEvents.length,
      };
    } catch (error) {
      console.error("💥 Error in sendSubscriptionEmailInternal:", error);
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
    const subscription = await ctx.db.get(args.subscriptionId);

    if (!subscription) {
      console.error(
        `❌ Subscription with id '${args.subscriptionId}' not found when updating email time`,
      );
      return;
    }

    const now = Date.now();
    const emailFrequency = subscription.emailFrequencyHours || 24;
    const nextEmailTime = now + emailFrequency * 60 * 60 * 1000;

    await ctx.db.patch(args.subscriptionId, {
      lastEmailSent: now,
      nextEmailScheduled: nextEmailTime,
    });

    console.log(
      `✅ Updated email time for subscription '${args.subscriptionId}', next email scheduled for: ${new Date(nextEmailTime).toISOString()}`,
    );
  },
});

function generateEmailHtml(
  subscription: AnySubscription,
  queuedEvents: QueuedEventItem[],
  user: Doc<"users">,
): string {
  const subscriptionDescription = isPromptSubscription(subscription)
    ? subscription.prompt
    : "all events";

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

      if (!event) return "";

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
    .filter(Boolean)
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
          We found ${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} ${isPromptSubscription(subscription) ? "matching your subscription" : "for you"}:
        </p>
        ${
          isPromptSubscription(subscription)
            ? `
        <p style="margin: 8px 0 0 0; color: #3b82f6; font-weight: 600; font-size: 16px;">
          "${subscription.prompt}"
        </p>
        `
            : `
        <p style="margin: 8px 0 0 0; color: #3b82f6; font-weight: 600; font-size: 16px;">
          All Events Subscription
        </p>
        `
        }
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

  console.log(
    `✅ Generated email HTML for ${queuedEvents.length} events (${html.length} characters)`,
  );
  return html;
}
