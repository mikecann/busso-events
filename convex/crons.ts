import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

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
        internal.emails.emailsInternal.cleanupOldQueueItems,
      );
      console.log(`🧹 Cleaned up ${deletedCount} old email queue items`);
      return { deletedCount };
    } catch (error) {
      console.error("💥 Error in email queue cleanup job:", error);
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
          internal.eventSources.eventSourcesInternal
            .performScheduledSourceScrape,
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

crons.interval(
  "cleanup email queue",
  { hours: 3 },
  internal.crons.cleanupEmailQueue,
  {},
);

export default crons;
