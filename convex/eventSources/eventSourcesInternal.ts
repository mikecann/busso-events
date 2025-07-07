import {
  internalQuery,
  internalMutation,
  internalAction,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  SourceScrapeResult,
  TestScrapeResult,
  TestScrapeProgress,
  calculateNextScrapeTime,
  getInitialScrapeDelay,
  formatScrapeError,
  createSourceError,
  SOURCE_CONSTANTS,
} from "./common";

// INTERNAL QUERIES

export const getActiveSources = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"eventSources">[]> => {
    return await ctx.db
      .query("eventSources")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getSourceById = internalQuery({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args): Promise<Doc<"eventSources"> | null> => {
    return await ctx.db.get(args.sourceId);
  },
});

export const getTestScrapeById = internalQuery({
  args: {
    testScrapeId: v.id("testScrapes"),
  },
  handler: async (ctx, args): Promise<Doc<"testScrapes"> | null> => {
    return await ctx.db.get(args.testScrapeId);
  },
});

// INTERNAL MUTATIONS

export const updateLastScrapeTime = internalMutation({
  args: {
    sourceId: v.id("eventSources"),
    timestamp: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    console.log(
      `🔄 updateLastScrapeTime called for sourceId: ${args.sourceId} at timestamp: ${new Date(args.timestamp).toISOString()}`,
    );

    // Always update the last scrape time first
    await ctx.db.patch(args.sourceId, {
      dateLastScrape: args.timestamp,
    });

    console.log(`📅 Calling scheduleNextScrape for sourceId: ${args.sourceId}`);

    // Try to schedule next scrape, but don't fail the entire operation if it fails
    try {
      await scheduleNextScrape(ctx, args.sourceId);
      console.log(
        `✅ Successfully scheduled next scrape for sourceId: ${args.sourceId}`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to schedule next scrape for sourceId: ${args.sourceId}`,
        error,
      );
      // Don't throw the error here - we want to ensure the lastScrapeTime update succeeds
      // The error has already been logged, and manual intervention or retry logic can handle it
      console.log(
        `⚠️ Source ${args.sourceId} lastScrapeTime updated but next scrape not scheduled - manual intervention may be needed`,
      );
    }
  },
});

export const clearScheduledScrape = internalMutation({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.sourceId, {
      nextScrapeScheduledId: undefined,
      nextScrapeScheduledAt: undefined,
    });
  },
});

export const updateTestScrapeProgress = internalMutation({
  args: {
    testScrapeId: v.id("testScrapes"),
    progress: v.object({
      stage: v.string(),
      message: v.string(),
      eventsFound: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.testScrapeId, {
      status: "running",
      progress: args.progress,
    });
  },
});

export const completeTestScrape = internalMutation({
  args: {
    testScrapeId: v.id("testScrapes"),
    result: v.object({
      success: v.boolean(),
      message: v.string(),
      eventsFound: v.optional(v.number()),
      data: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.testScrapeId, {
      status: args.result.success ? "completed" : "failed",
      result: args.result,
      completedAt: Date.now(),
    });
  },
});

export const createTestScrape = internalMutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"testScrapes">> => {
    return await ctx.db.insert("testScrapes", {
      url: args.url,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateSchedulingInfo = internalMutation({
  args: {
    sourceId: v.id("eventSources"),
    nextScrapeScheduledId: v.id("_scheduled_functions"),
    nextScrapeScheduledAt: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.sourceId, {
      nextScrapeScheduledId: args.nextScrapeScheduledId,
      nextScrapeScheduledAt: args.nextScrapeScheduledAt,
    });
  },
});

// INTERNAL ACTIONS

export const performSourceScrape = internalAction({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args): Promise<SourceScrapeResult> => {
    try {
      console.log(`🔍 Starting source scrape for sourceId: ${args.sourceId}`);

      // Get the source
      const source = await ctx.runQuery(
        internal.eventSources.eventSourcesInternal.getSourceById,
        {
          sourceId: args.sourceId,
        },
      );

      if (!source) {
        console.error(`❌ Event source not found: ${args.sourceId}`);
        return {
          success: false,
          message: `Event source with id '${args.sourceId}' not found`,
        };
      }

      console.log(`✅ Found source: ${source.name} (${source.startingUrl})`);

      // Scrape the source page using the general URL scraping function
      console.log(`🌐 Scraping URL: ${source.startingUrl}`);
      const scrapeResult = await ctx.runAction(
        internal.scraping.scrapingInternal.scrapeUrlInternal,
        { url: source.startingUrl },
      );

      if (!scrapeResult.success) {
        console.error(`❌ Scrape failed: ${scrapeResult.message}`);
        return {
          success: false,
          message: `Failed to scrape source URL: ${scrapeResult.message}`,
        };
      }

      console.log(
        `✅ Scrape successful, content length: ${scrapeResult.data?.contentLength || 0}`,
      );

      // Extract events from the scraped data
      const events = scrapeResult.data?.extractedEvents || [];
      console.log(`📝 Found ${events.length} potential events`);

      let eventsCreated = 0;

      // Process each event found
      for (const eventData of events) {
        try {
          console.log(
            `🔄 Processing event: ${eventData.title} (${eventData.url || "no URL"})`,
          );

          // Skip events without required fields
          if (!eventData.url || !eventData.title) {
            console.log(
              `⏭️ Skipping event with missing required fields: ${eventData.title || "no title"}`,
            );
            continue;
          }

          // Check if event already exists
          const existingEvent = await ctx.runQuery(
            internal.events.eventsInternal.getEventByUrl,
            {
              url: eventData.url,
            },
          );

          if (!existingEvent) {
            // Create new event
            console.log(`➕ Creating new event: ${eventData.title}`);

            // Parse event date
            let eventDate = Date.now() + 24 * 60 * 60 * 1000; // Default to tomorrow
            if (eventData.eventDate) {
              if (typeof eventData.eventDate === "string") {
                const parsedDate = new Date(eventData.eventDate);
                if (!isNaN(parsedDate.getTime())) {
                  eventDate = parsedDate.getTime();
                }
              } else if (typeof eventData.eventDate === "number") {
                eventDate = eventData.eventDate;
              }
            }

            await ctx.runMutation(
              internal.events.eventsInternal.createInternal,
              {
                title: eventData.title,
                description:
                  eventData.description ||
                  `Event: ${eventData.title}. More details available at ${eventData.url}`,
                eventDate: eventDate,
                imageUrl: eventData.imageUrl || "",
                url: eventData.url,
                sourceId: args.sourceId,
              },
            );
            eventsCreated++;
          } else {
            console.log(
              `⏭️ Event already exists, skipping: ${eventData.title}`,
            );
          }
        } catch (error) {
          console.error(
            `❌ Failed to process event ${eventData.url || "unknown URL"}:`,
            error,
          );
        }
      }

      // Update the source's last scrape time
      console.log(`🔄 Updating last scrape time for source: ${source.name}`);
      await ctx.runMutation(
        internal.eventSources.eventSourcesInternal.updateLastScrapeTime,
        {
          sourceId: args.sourceId,
          timestamp: Date.now(),
        },
      );

      const message = `Successfully scraped source '${source.name}'. Created ${eventsCreated} new events from ${events.length} total events found.`;
      console.log(`✅ ${message}`);

      return {
        success: true,
        message,
        eventsFound: eventsCreated,
        data: {
          sourceName: source.name,
          sourceUrl: source.startingUrl,
          totalEventsFound: events.length,
          newEventsCreated: eventsCreated,
          existingEventsSkipped: events.length - eventsCreated,
        },
      };
    } catch (error) {
      const errorMessage = formatScrapeError(args.sourceId, error);
      console.error(`❌ ${errorMessage}`);
      console.error("Error details:", error);

      return {
        success: false,
        message: errorMessage,
      };
    }
  },
});

export const performTestScrape = internalAction({
  args: {
    testScrapeId: v.id("testScrapes"),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      console.log(
        `🧪 Starting test scrape for testScrapeId: ${args.testScrapeId}`,
      );

      const testScrape = await ctx.runQuery(
        internal.eventSources.eventSourcesInternal.getTestScrapeById,
        {
          testScrapeId: args.testScrapeId,
        },
      );

      if (!testScrape) {
        throw new Error(`Test scrape with id '${args.testScrapeId}' not found`);
      }

      console.log(`✅ Found test scrape for URL: ${testScrape.url}`);

      // Update progress: fetching
      await ctx.runMutation(
        internal.eventSources.eventSourcesInternal.updateTestScrapeProgress,
        {
          testScrapeId: args.testScrapeId,
          progress: {
            stage: "fetching",
            message: "Fetching content from URL...",
          },
        },
      );

      // Scrape the URL
      console.log(`🌐 Scraping URL: ${testScrape.url}`);
      const scrapeResult = await ctx.runAction(
        internal.scraping.scrapingInternal.scrapeUrlInternal,
        { url: testScrape.url },
      );

      if (!scrapeResult.success) {
        console.error(`❌ Scrape failed: ${scrapeResult.message}`);
        await ctx.runMutation(
          internal.eventSources.eventSourcesInternal.completeTestScrape,
          {
            testScrapeId: args.testScrapeId,
            result: {
              success: false,
              message: `Failed to scrape URL: ${scrapeResult.message}`,
            },
          },
        );
        return;
      }

      // Update progress: extracting
      await ctx.runMutation(
        internal.eventSources.eventSourcesInternal.updateTestScrapeProgress,
        {
          testScrapeId: args.testScrapeId,
          progress: {
            stage: "extracting",
            message: "Extracting events from content...",
          },
        },
      );

      // Extract events from scraped data
      const events = scrapeResult.data?.extractedEvents || [];
      console.log(`📝 Found ${events.length} potential events`);

      // Update progress: processing
      await ctx.runMutation(
        internal.eventSources.eventSourcesInternal.updateTestScrapeProgress,
        {
          testScrapeId: args.testScrapeId,
          progress: {
            stage: "processing",
            message: `Found ${events.length} potential events`,
            eventsFound: events.length,
          },
        },
      );

      // Complete the test scrape
      const message = `Successfully scraped URL '${testScrape.url}'. Found ${events.length} potential events.`;
      console.log(`✅ ${message}`);

      await ctx.runMutation(
        internal.eventSources.eventSourcesInternal.completeTestScrape,
        {
          testScrapeId: args.testScrapeId,
          result: {
            success: true,
            message,
            eventsFound: events.length,
            data: {
              url: testScrape.url,
              totalEventsFound: events.length,
              scrapedData: scrapeResult.data,
              extractedEvents: events,
            },
          },
        },
      );
    } catch (error) {
      const errorMessage = `Failed to scrape URL: ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(
        `❌ Test scrape failed for testScrapeId: ${args.testScrapeId}`,
        error,
      );

      await ctx.runMutation(
        internal.eventSources.eventSourcesInternal.completeTestScrape,
        {
          testScrapeId: args.testScrapeId,
          result: {
            success: false,
            message: errorMessage,
          },
        },
      );
    }
  },
});

export const performScheduledSourceScrape = internalAction({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      console.log(
        `⏰ Starting scheduled scrape for sourceId: ${args.sourceId}`,
      );

      // Get the source to verify it's still active
      const source = await ctx.runQuery(
        internal.eventSources.eventSourcesInternal.getSourceById,
        {
          sourceId: args.sourceId,
        },
      );

      if (!source) {
        console.log(
          `❌ Source not found for scheduled scrape: ${args.sourceId}`,
        );
        return;
      }

      if (!source.isActive) {
        console.log(
          `⏸️ Source is inactive, skipping scheduled scrape: ${source.name}`,
        );
        // Clear the scheduled scrape since source is inactive
        await ctx.runMutation(
          internal.eventSources.eventSourcesInternal.clearScheduledScrape,
          {
            sourceId: args.sourceId,
          },
        );
        return;
      }

      console.log(
        `✅ Running scheduled scrape for active source: ${source.name}`,
      );

      // Perform the scrape using the existing scrape logic
      const result = await ctx.runAction(
        internal.eventSources.eventSourcesInternal.performSourceScrape,
        {
          sourceId: args.sourceId,
        },
      );

      if (result.success) {
        console.log(
          `✅ Scheduled scrape completed successfully for ${source.name}: ${result.message}`,
        );

        // DO NOT clear scheduled scrape info on success!
        // The performSourceScrape -> updateLastScrapeTime -> scheduleNextScrape chain
        // has already created and stored the NEXT scheduled job info.
        // Clearing it now would orphan the next scheduled job.
        console.log(
          `📅 Next scrape has been scheduled for ${source.name}, keeping schedule info`,
        );
      } else {
        console.error(
          `❌ Scheduled scrape failed for ${source.name}: ${result.message}`,
        );

        // For failed scrapes, keep the current scheduling info but log the issue
        // This prevents the source from becoming unscheduled due to temporary failures
        console.log(
          `⚠️ Keeping existing schedule for ${source.name} due to scrape failure`,
        );
      }
    } catch (error) {
      console.error(
        `💥 Error in scheduled source scrape for ${args.sourceId}:`,
        error,
      );

      // For errors, also keep the scheduling info to prevent permanent unscheduling
      // Log the error but don't clear the schedule
      console.log(
        `⚠️ Keeping existing schedule for source ${args.sourceId} due to error`,
      );
    }
  },
});

// Helper function to schedule next scraping for a source
async function scheduleNextScrape(
  ctx: any,
  sourceId: Id<"eventSources">,
): Promise<void> {
  try {
    console.log(`📅 scheduleNextScrape called for sourceId: ${sourceId}`);

    const source = await ctx.db.get(sourceId);
    if (!source) {
      console.log(`❌ Source not found: ${sourceId}`);
      return;
    }

    if (!source.isActive) {
      console.log(`⏸️ Source is inactive, skipping scheduling: ${source.name}`);
      return;
    }

    console.log(`✅ Scheduling next scrape for active source: ${source.name}`);

    // Cancel any existing scheduled scraping for this source
    if (source.nextScrapeScheduledId) {
      try {
        console.log(
          `🗑️ Canceling existing scheduled scrape: ${source.nextScrapeScheduledId}`,
        );
        await ctx.scheduler.cancel(source.nextScrapeScheduledId);
      } catch (error) {
        // Ignore errors if the job was already completed or doesn't exist
        console.log("Could not cancel existing scrape job:", error);
      }
    }

    // Schedule next scraping in 3 days (72 hours)
    const delayMs =
      SOURCE_CONSTANTS.DEFAULT_SCRAPE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

    let scheduledId;
    try {
      scheduledId = await ctx.scheduler.runAfter(
        delayMs,
        internal.eventSources.eventSourcesInternal.performScheduledSourceScrape,
        { sourceId },
      );
      console.log(
        `⏰ Scheduled next scrape with ID: ${scheduledId}, delay: ${delayMs}ms (${SOURCE_CONSTANTS.DEFAULT_SCRAPE_INTERVAL_DAYS} days)`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to schedule next scrape for source ${source.name}:`,
        error,
      );
      throw new Error(
        `Failed to schedule next scrape for source '${source.name}': ${error instanceof Error ? error.message : "Unknown scheduler error"}`,
      );
    }

    // Update the source with the scheduled job info
    try {
      await ctx.db.patch(sourceId, {
        nextScrapeScheduledId: scheduledId,
        nextScrapeScheduledAt: Date.now() + delayMs,
      });
      console.log(
        `✅ Successfully scheduled next scrape for ${source.name} at ${new Date(Date.now() + delayMs).toISOString()}`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to update source ${source.name} with scheduling info:`,
        error,
      );

      // If we can't update the database, try to cancel the scheduled job to prevent orphaned jobs
      try {
        await ctx.scheduler.cancel(scheduledId);
        console.log(`🗑️ Canceled orphaned scheduled job: ${scheduledId}`);
      } catch (cancelError) {
        console.error(
          `❌ Could not cancel orphaned job ${scheduledId}:`,
          cancelError,
        );
      }

      throw new Error(
        `Failed to update source '${source.name}' with scheduling info: ${error instanceof Error ? error.message : "Unknown database error"}`,
      );
    }
  } catch (error) {
    console.error(
      `💥 Critical error in scheduleNextScrape for sourceId ${sourceId}:`,
      error,
    );
    // Re-throw the error so calling code can handle it appropriately
    throw error;
  }
}
