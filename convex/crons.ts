import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

// Send emails for subscriptions that are ready
export const sendScheduledEmails = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ processed: number; successful: number; failed: number }> => {
    console.log(
      "📧 Starting scheduled email sending job at:",
      new Date().toISOString(),
    );

    try {
      // Get all subscriptions that are ready for email sending
      const readySubscriptions = await ctx.runQuery(
        internal.subscriptionQueries.getSubscriptionsReadyForEmail,
      );

      console.log("📊 Found subscriptions ready for email:", {
        count: readySubscriptions.length,
        subscriptions: readySubscriptions.map((s: any) => ({
          id: s._id,
          userId: s.userId,
          prompt: s.prompt.substring(0, 50) + "...",
          nextEmailScheduled: s.nextEmailScheduled
            ? new Date(s.nextEmailScheduled).toISOString()
            : "Not scheduled",
          isReady: s.nextEmailScheduled
            ? s.nextEmailScheduled <= Date.now()
            : false,
        })),
      });

      if (readySubscriptions.length === 0) {
        console.log("✅ No subscriptions ready for email sending");
        return { processed: 0, successful: 0, failed: 0 };
      }

      let successful = 0;
      let failed = 0;

      // Process each subscription
      for (const subscription of readySubscriptions) {
        console.log(
          `📧 Processing subscription ${subscription._id} for user ${subscription.userId}`,
        );

        try {
          const result = await ctx.runAction(
            internal.emailSending.sendSubscriptionEmailInternal,
            {
              subscriptionId: subscription._id,
            },
          );

          if (result.success) {
            console.log(
              `✅ Email sent successfully for subscription ${subscription._id}:`,
              result,
            );
            successful++;
          } else {
            console.error(
              `❌ Email failed for subscription ${subscription._id}:`,
              result.message,
            );
            failed++;
          }
        } catch (error) {
          console.error(
            `💥 Error processing subscription ${subscription._id}:`,
            error,
          );
          failed++;
        }
      }

      const summary = {
        processed: readySubscriptions.length,
        successful,
        failed,
      };

      console.log("📧 Scheduled email sending job completed:", summary);
      return summary;
    } catch (error) {
      console.error("💥 Error in scheduled email sending job:", error);
      throw error;
    }
  },
});

// Clean up old email queue items (older than 30 days)
export const cleanupEmailQueue = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deletedCount: number }> => {
    console.log(
      "🧹 Starting email queue cleanup job at:",
      new Date().toISOString(),
    );

    try {
      const deletedCount: number = await ctx.runMutation(
        internal.emailQueue.cleanupOldQueueItems,
      );
      console.log(`🧹 Cleaned up ${deletedCount} old email queue items`);
      return { deletedCount };
    } catch (error) {
      console.error("💥 Error in email queue cleanup job:", error);
      throw error;
    }
  },
});

// Check for active sources missing scheduled scrapes and fix them
export const checkSourceScheduling = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ sourcesFixed: number; sourcesChecked: number }> => {
    console.log(
      "📅 Starting source scheduling check job at:",
      new Date().toISOString(),
    );

    try {
      const result = await ctx.runMutation(
        internal.crons.fixMissingSourceSchedules,
      );
      console.log(
        `📅 Source scheduling check completed: ${result.sourcesFixed} sources fixed out of ${result.sourcesChecked} checked`,
      );
      return result;
    } catch (error) {
      console.error("💥 Error in source scheduling check job:", error);
      throw error;
    }
  },
});

// Internal mutation to fix missing source schedules
export const fixMissingSourceSchedules = internalMutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ sourcesFixed: number; sourcesChecked: number }> => {
    const sources = await ctx.db.query("eventSources").collect();
    let sourcesFixed = 0;
    let sourcesChecked = 0;

    for (const source of sources) {
      sourcesChecked++;

      // Check if active source is missing scheduled scrape
      if (source.isActive && !source.nextScrapeScheduledId) {
        console.log(`📅 Fixing missing schedule for source: ${source.name}`);

        // Calculate when next scrape should be based on last scrape
        let delayMs;
        if (source.dateLastScrape) {
          // If last scraped, next scrape should be 3 days after
          const threeDaysAfterLastScrape =
            source.dateLastScrape + 3 * 24 * 60 * 60 * 1000;
          const now = Date.now();

          if (threeDaysAfterLastScrape <= now) {
            // Overdue, schedule immediately
            delayMs = 0;
          } else {
            // Schedule for the calculated time
            delayMs = threeDaysAfterLastScrape - now;
          }
        } else {
          // Never scraped, schedule for 5 minutes from now
          delayMs = 5 * 60 * 1000;
        }

        // Schedule the scrape
        const scheduledId = await ctx.scheduler.runAfter(
          delayMs,
          internal.eventSources.performScheduledSourceScrape,
          { sourceId: source._id },
        );

        // Update the source with the scheduled job info
        await ctx.db.patch(source._id, {
          nextScrapeScheduledId: scheduledId,
          nextScrapeScheduledAt: Date.now() + delayMs,
        });

        sourcesFixed++;
      }
    }

    return { sourcesFixed, sourcesChecked };
  },
});

const crons = cronJobs();

// Send emails every 30 minutes
crons.interval(
  "send scheduled emails",
  { minutes: 30 },
  internal.crons.sendScheduledEmails,
  {},
);

// Clean up old email queue items daily at 2 AM
crons.cron(
  "cleanup email queue",
  "0 2 * * *",
  internal.crons.cleanupEmailQueue,
  {},
);

// Check for active sources missing scheduled scrapes and fix them daily at 3 AM
crons.cron(
  "check source scheduling",
  "0 3 * * *",
  internal.crons.checkSourceScheduling,
  {},
);

export default crons;
