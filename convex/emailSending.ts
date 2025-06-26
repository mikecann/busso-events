import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import {
  isPromptSubscription,
  AnySubscription,
  QueuedEventItem,
} from "./subscriptions/common";
import { Resend } from "resend";
import { marked } from "marked";
import { isDevelopmentMode } from "./utils";

if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

const resend = new Resend(process.env.RESEND_API_KEY);

// Detect environment and choose appropriate from address
const getFromAddress = (): string => {
  if (isDevelopmentMode()) {
    return "Busso Events Dev <onboarding@resend.dev>";
  }

  return (
    process.env.EMAIL_FROM_ADDRESS ||
    "Busso Events Notifications <notifications@busso.events>"
  );
};

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

      // Check if we're in development mode
      if (isDevelopmentMode()) {
        console.log(`🚫 DEVELOPMENT MODE: Skipping actual email sending`);
        console.log(`📧 Would have sent email to: ${user.email}`);
        console.log(`📧 Subject: ${emailSubject}`);
        console.log(`📧 Events count: ${queuedEvents.length}`);
        console.log(`📧 Email content length: ${emailHtml.length} characters`);
      } else {
        // Send the email using Resend in production
        const fromAddress = getFromAddress();
        console.log(`📧 Sending email from: ${fromAddress} to: ${user.email}`);

        const { data, error } = await resend.emails.send({
          from: fromAddress,
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
      }

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
      <div style="border: 1px solid #e0e7ff; border-radius: 12px; padding: 24px; margin-bottom: 24px; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        ${
          event.imageUrl
            ? `
          <img src="${event.imageUrl}" alt="${event.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 16px;">
        `
            : ""
        }
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
          <span style="background-color: ${getScoreColor(queueItem.matchScore)}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
            Match: ${(queueItem.matchScore * 100).toFixed(0)}%
          </span>
          <span style="background-color: #6366f1; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
            ${queueItem.matchType === "semantic" ? "AI Match" : "Title Match"}
          </span>
        </div>
        
        <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #1e293b; line-height: 1.3;">
          ${event.title}
        </h3>
        
        <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px; display: flex; align-items: center; gap: 8px;">
          <span style="color: #6366f1;">📅</span> ${formatDate(event.eventDate)}
        </p>
        
        <div style="margin: 0 0 20px 0; color: #475569; line-height: 1.6; font-size: 15px;">
          ${marked(event.description, { breaks: true })}
        </div>
        
        <a href="${event.url}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: all 0.2s ease;">
          View Event Details →
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
      <title>New Events from Busso Events</title>
      <style>
        @media only screen and (max-width: 600px) {
          .container { padding: 10px !important; }
          .event-card { padding: 16px !important; }
          .hero-title { font-size: 28px !important; }
        }
      </style>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc;">
      
      <!-- Header with Hero Background -->
      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center;">
        <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto;">
          <tr>
            <td style="text-align: center;">
              <a href="https://busso.events" style="text-decoration: none; display: inline-block;">
                <img src="https://busso.events/logo-128.png" alt="Busso Events Logo" style="width: 64px; height: 64px; margin-bottom: 16px; border-radius: 12px;" />
                <h1 style="margin: 0 0 12px 0; color: white; font-size: 32px; font-weight: 700; text-decoration: none;" class="hero-title">
                  Busso Events
                </h1>
              </a>
              <p style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.9); font-size: 18px; font-weight: 500;">
                🎉 New Events Found!
              </p>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.8); font-size: 16px;">
                We found ${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} ${isPromptSubscription(subscription) ? "matching your subscription" : "for you"}
              </p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Subscription Info -->
      ${
        isPromptSubscription(subscription)
          ? `
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
        <div style="max-width: 600px; margin: 0 auto;">
          <p style="margin: 0; color: #475569; font-size: 14px; font-weight: 500;">
            Subscription: <span style="color: #6366f1; font-weight: 600;">"${subscription.prompt}"</span>
          </p>
        </div>
      </div>
      `
          : `
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
        <div style="max-width: 600px; margin: 0 auto;">
          <p style="margin: 0; color: #475569; font-size: 14px; font-weight: 500;">
            Subscription: <span style="color: #6366f1; font-weight: 600;">All Events</span>
          </p>
        </div>
      </div>
      `
      }

      <!-- Main Content -->
      <div style="max-width: 600px; margin: 0 auto; padding: 32px 20px;" class="container">
        ${eventCards}
      </div>

      <!-- Footer -->
      <div style="background-color: #1e293b; padding: 32px 20px; text-align: center;">
        <div style="max-width: 600px; margin: 0 auto;">
          <a href="https://busso.events" style="text-decoration: none; display: inline-block; margin-bottom: 16px;">
            <img src="https://busso.events/logo-128.png" alt="Busso Events Logo" style="width: 40px; height: 40px; border-radius: 8px;" />
          </a>
          <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 16px; font-weight: 600;">
            Busso Events
          </p>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">
            All the events for Busselton and the south west, aggregated in one place
          </p>
          <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">
            You're receiving this because you subscribed to event notifications.
          </p>
          <a href="https://busso.events" style="display: inline-block; background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
            Manage Subscriptions
          </a>
        </div>
      </div>

    </body>
    </html>
  `;

  console.log(
    `✅ Generated email HTML for ${queuedEvents.length} events (${html.length} characters)`,
  );
  return html;
}
