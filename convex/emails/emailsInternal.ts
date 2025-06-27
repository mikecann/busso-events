import {
  internalQuery,
  internalMutation,
  internalAction,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { Resend } from "resend";
import { marked } from "marked";
import { isDevelopmentMode } from "../utils";
import {
  QueuedEventItem,
  EmailSendResult,
  EmailQueueStats,
  EmailContent,
  EmailTemplateData,
  formatDate,
  getScoreColor,
  getScoreLabel,
  truncateText,
  sanitizeHtml,
  EMAIL_TEMPLATE_CONSTANTS,
  validateEmailData,
} from "./common";
import { isPromptSubscription, AnySubscription } from "../subscriptions/common";

if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

const resend = new Resend(process.env.RESEND_API_KEY);

// Detect environment and choose appropriate from address
const getFromAddress = (): string => {
  if (isDevelopmentMode()) {
    return EMAIL_TEMPLATE_CONSTANTS.DEV_FROM_ADDRESS;
  }
  return (
    process.env.EMAIL_FROM_ADDRESS ||
    EMAIL_TEMPLATE_CONSTANTS.DEFAULT_FROM_ADDRESS
  );
};

// INTERNAL QUERIES

export const getQueuedEventsForSubscription = internalQuery({
  args: {
    subscriptionId: v.id("subscriptions"),
    includeAlreadySent: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<QueuedEventItem[]> => {
    let query = ctx.db
      .query("emailQueue")
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId),
      );

    if (!args.includeAlreadySent) {
      query = query.filter((q) => q.neq(q.field("emailSent"), true));
    }

    const queueItems = await query.collect();

    // Get the full event data for each queue item
    const queueWithEvents = await Promise.all(
      queueItems.map(async (item) => {
        const event = await ctx.db.get(item.eventId);
        return {
          ...item,
          event,
        };
      }),
    );

    // Filter out items where event was deleted and sort by match score
    return queueWithEvents
      .filter((item) => item.event !== null)
      .sort((a, b) => b.matchScore - a.matchScore);
  },
});

export const getQueueStats = internalQuery({
  args: {},
  handler: async (ctx, args): Promise<EmailQueueStats> => {
    const totalQueued = await ctx.db.query("emailQueue").collect();
    const unsent = totalQueued.filter((item) => !item.emailSent);
    const sent = totalQueued.filter((item) => item.emailSent);

    return {
      total: totalQueued.length,
      unsent: unsent.length,
      sent: sent.length,
    };
  },
});

// INTERNAL MUTATIONS

export const addToQueue = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    eventId: v.id("events"),
    matchScore: v.number(),
    matchType: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    // Check if this event is already queued for this subscription
    const existing = await ctx.db
      .query("emailQueue")
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId),
      )
      .filter((q) => q.eq(q.field("eventId"), args.eventId))
      .first();

    if (existing) {
      // Update the existing entry if the new score is higher
      if (args.matchScore > existing.matchScore) {
        await ctx.db.patch(existing._id, {
          matchScore: args.matchScore,
          matchType: args.matchType,
          queuedAt: Date.now(),
        });
      }
      return existing._id;
    }

    // Add new item to queue
    const queueItemId = await ctx.db.insert("emailQueue", {
      subscriptionId: args.subscriptionId,
      eventId: args.eventId,
      matchScore: args.matchScore,
      matchType: args.matchType,
      queuedAt: Date.now(),
      emailSent: false,
    });

    // Check if subscription needs an email workpool job scheduled
    await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal
        .ensureEmailWorkpoolJobScheduled,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    return queueItemId;
  },
});

export const markEventsAsSent = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    eventIds: v.array(v.id("events")),
  },
  handler: async (ctx, args): Promise<void> => {
    validateEmailData({
      subscriptionId: args.subscriptionId,
      eventIds: args.eventIds,
    });

    const now = Date.now();

    for (const eventId of args.eventIds) {
      const queueItem = await ctx.db
        .query("emailQueue")
        .withIndex("by_subscription", (q) =>
          q.eq("subscriptionId", args.subscriptionId),
        )
        .filter((q) => q.eq(q.field("eventId"), eventId))
        .first();

      if (queueItem) {
        await ctx.db.patch(queueItem._id, {
          emailSent: true,
          emailSentAt: now,
        });
      }
    }
  },
});

export const cleanupOldQueueItems = internalMutation({
  args: {},
  handler: async (ctx, args): Promise<number> => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const oldItems = await ctx.db
      .query("emailQueue")
      .withIndex("by_queued_at", (q) => q.lt("queuedAt", thirtyDaysAgo))
      .collect();

    let deletedCount = 0;
    for (const item of oldItems) {
      await ctx.db.delete(item._id);
      deletedCount++;
    }

    return deletedCount;
  },
});

export const updateSubscriptionEmailTime = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<void> => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      throw new Error(
        `Subscription with id '${args.subscriptionId}' not found`,
      );
    }

    const now = Date.now();
    const nextEmailTime =
      now + subscription.emailFrequencyHours * 60 * 60 * 1000;

    await ctx.db.patch(args.subscriptionId, {
      lastEmailSent: now,
      nextEmailScheduled: nextEmailTime,
    });
  },
});

// INTERNAL ACTIONS

export const sendSubscriptionEmailInternal = internalAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<EmailSendResult> => {
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
        internal.emails.emailsInternal.getQueuedEventsForSubscription,
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
      const emailContent = generateEmailContent(
        subscription,
        queuedEvents,
        user,
      );
      const emailSubject = isPromptSubscription(subscription)
        ? `${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} matching "${subscription.prompt}"`
        : `${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} for you`;

      // Check if we're in development mode
      if (isDevelopmentMode()) {
        console.log(`🚫 DEVELOPMENT MODE: Skipping actual email sending`);
        console.log(`📧 Would have sent email to: ${user.email}`);
        console.log(`📧 Subject: ${emailSubject}`);
        console.log(`📧 Events count: ${queuedEvents.length}`);
        console.log(
          `📧 Email content length: ${emailContent.html.length} characters`,
        );
      } else {
        // Send the email using Resend in production
        const fromAddress = getFromAddress();
        console.log(`📧 Sending email from: ${fromAddress} to: ${user.email}`);

        const { data, error } = await resend.emails.send({
          from: fromAddress,
          to: user.email,
          subject: emailSubject,
          html: emailContent.html,
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
      await ctx.runMutation(internal.emails.emailsInternal.markEventsAsSent, {
        subscriptionId: args.subscriptionId,
        eventIds: queuedEvents.map((e) => e.eventId),
      });

      // Update subscription's last email sent time
      await ctx.runMutation(
        internal.emails.emailsInternal.updateSubscriptionEmailTime,
        {
          subscriptionId: args.subscriptionId,
        },
      );

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

// Email content generation function
function generateEmailContent(
  subscription: AnySubscription,
  queuedEvents: QueuedEventItem[],
  user: Doc<"users">,
): EmailContent {
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
    if (score >= 0.4) return "#f97316"; // orange
    return "#ef4444"; // red
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return "Excellent match";
    if (score >= 0.6) return "Good match";
    if (score >= 0.4) return "Fair match";
    return "Poor match";
  };

  // Limit events to prevent huge emails
  const eventsToShow = queuedEvents.slice(
    0,
    EMAIL_TEMPLATE_CONSTANTS.MAX_EVENTS_PER_EMAIL,
  );
  const hasMoreEvents = queuedEvents.length > eventsToShow.length;

  const subscriptionType = isPromptSubscription(subscription)
    ? "prompt"
    : "all_events";
  const promptText = isPromptSubscription(subscription)
    ? subscription.prompt
    : "all events";

  const eventsHtml = eventsToShow
    .map((item) => {
      if (!item.event) return "";

      const event = item.event;
      const scoreColor = getScoreColor(item.matchScore);
      const scoreLabel = getScoreLabel(item.matchScore);
      const truncatedDescription = truncateText(
        event.description || "",
        EMAIL_TEMPLATE_CONSTANTS.MAX_DESCRIPTION_LENGTH,
      );

      return `
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 18px;">
            <a href="${event.url}" style="color: #3b82f6; text-decoration: none;">${event.title}</a>
          </h3>
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
            📅 ${formatDate(event.eventDate)}
          </p>
          <p style="margin: 0 0 10px 0; color: #374151; line-height: 1.5;">
            ${truncatedDescription}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="background-color: ${scoreColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
              ${scoreLabel} (${Math.round(item.matchScore * 100)}%)
            </span>
            <a href="${event.url}" style="background-color: #3b82f6; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px;">
              View Event
            </a>
          </div>
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
      <title>New Events for You</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
            🎉 New Events Found!
          </h1>
          <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">
            We found ${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} matching your subscription
          </p>
        </div>
        
        <div style="padding: 30px;">
          <div style="margin-bottom: 25px; padding: 15px; background-color: #f3f4f6; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <h2 style="margin: 0 0 10px 0; color: #1f2937; font-size: 18px;">
              Your Subscription
            </h2>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              ${subscriptionType === "prompt" ? `Prompt: "${promptText}"` : "All events"}
            </p>
          </div>
          
          ${eventsHtml}
          
          ${
            hasMoreEvents
              ? `
            <div style="text-align: center; margin-top: 20px; padding: 15px; background-color: #f3f4f6; border-radius: 6px;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                And ${queuedEvents.length - eventsToShow.length} more event${queuedEvents.length - eventsToShow.length > 1 ? "s" : ""}...
              </p>
            </div>
          `
              : ""
          }
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px;">
              You're receiving this email because you're subscribed to event notifications.
            </p>
            <a href="${process.env.CONVEX_SITE_URL || "https://busso.events"}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
              Manage Subscriptions
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    subject: `${queuedEvents.length} new event${queuedEvents.length > 1 ? "s" : ""} for you`,
    html: sanitizeHtml(html),
  };
}
