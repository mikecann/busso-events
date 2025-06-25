import {
  internalAction,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { adminQuery, adminMutation, adminAction } from "./utils";

export const list = adminQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("eventSources").order("desc").collect();
  },
});

export const getById = adminQuery({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sourceId);
  },
});

export const create = adminMutation({
  args: {
    name: v.string(),
    startingUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const sourceId = await ctx.db.insert("eventSources", {
      name: args.name,
      startingUrl: args.startingUrl,
      isActive: true,
    });

    // Schedule first scrape for new source (5 minutes delay to allow immediate manual testing)
    const delayMs = 5 * 60 * 1000; // 5 minutes
    const scheduledId = await ctx.scheduler.runAfter(
      delayMs,
      internal.eventSources.performScheduledSourceScrape,
      { sourceId },
    );

    // Update the source with the scheduled job info
    await ctx.db.patch(sourceId, {
      nextScrapeScheduledId: scheduledId,
      nextScrapeScheduledAt: Date.now() + delayMs,
    });

    return sourceId;
  },
});

export const update = adminMutation({
  args: {
    id: v.id("eventSources"),
    name: v.optional(v.string()),
    startingUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    // Get the current source to check for status changes
    const currentSource = await ctx.db.get(id);
    if (!currentSource) {
      throw new Error(`Event source with id '${id}' not found`);
    }

    await ctx.db.patch(id, filteredUpdates);

    // Handle scheduling changes based on isActive status
    if (updates.isActive !== undefined) {
      if (updates.isActive === false) {
        // Source is being deactivated - cancel any scheduled scrape
        if (currentSource.nextScrapeScheduledId) {
          try {
            await ctx.scheduler.cancel(currentSource.nextScrapeScheduledId);
          } catch (error) {
            console.log("Could not cancel scheduled scrape:", error);
          }
        }
        // Clear scheduling info
        await ctx.db.patch(id, {
          nextScrapeScheduledId: undefined,
          nextScrapeScheduledAt: undefined,
        });
      } else if (updates.isActive === true && !currentSource.isActive) {
        // Source is being activated - schedule next scrape
        await scheduleNextScrape(ctx, id);
      }
    }
  },
});

export const remove = adminMutation({
  args: {
    id: v.id("eventSources"),
  },
  handler: async (ctx, args) => {
    // Get the source to cancel any scheduled scrapes
    const source = await ctx.db.get(args.id);
    if (source?.nextScrapeScheduledId) {
      try {
        await ctx.scheduler.cancel(source.nextScrapeScheduledId);
      } catch (error) {
        console.log("Could not cancel scheduled scrape on delete:", error);
      }
    }

    await ctx.db.delete(args.id);
  },
});

export const testScrape = adminAction({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    message: string;
    eventsFound?: number;
    data?: any;
  }> => {
    console.log(`🧪 Starting test scrape for sourceId: ${args.sourceId}`);

    try {
      const result = await ctx.runAction(
        internal.eventSources.performSourceScrape,
        {
          sourceId: args.sourceId,
        },
      );

      console.log(`🧪 Test scrape completed for sourceId: ${args.sourceId}`, {
        success: result.success,
        eventsFound: result.eventsFound,
      });

      return result;
    } catch (error) {
      const errorMessage = `Test scrape failed for sourceId '${args.sourceId}': ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(`❌ ${errorMessage}`);

      return {
        success: false,
        message: errorMessage,
      };
    }
  },
});

// Debug action to manually schedule a scrape
export const debugScheduleScrape = adminAction({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args) => {
    console.log(
      `🔧 Debug: Manually scheduling scrape for sourceId: ${args.sourceId}`,
    );

    try {
      await ctx.runMutation(internal.eventSources.updateLastScrapeTime, {
        sourceId: args.sourceId,
        timestamp: Date.now(),
      });

      return {
        success: true,
        message: "Scrape scheduled successfully",
      };
    } catch (error) {
      console.error(`❌ Debug schedule failed:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const startTestScrape = adminMutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const testScrapeId = await ctx.db.insert("testScrapes", {
      url: args.url,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.eventSources.performTestScrape, {
      testScrapeId,
    });

    return testScrapeId;
  },
});

// Internal queries
export const getActiveSources = internalQuery({
  args: {},
  handler: async (ctx) => {
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
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sourceId);
  },
});

// Internal mutations
export const updateLastScrapeTime = internalMutation({
  args: {
    sourceId: v.id("eventSources"),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    console.log(
      `🔄 updateLastScrapeTime called for sourceId: ${args.sourceId} at timestamp: ${new Date(args.timestamp).toISOString()}`,
    );

    await ctx.db.patch(args.sourceId, {
      dateLastScrape: args.timestamp,
    });

    console.log(`📅 Calling scheduleNextScrape for sourceId: ${args.sourceId}`);
    // Schedule next scrape in 3 days
    await scheduleNextScrape(ctx, args.sourceId);
  },
});

// Helper function to schedule next scraping for a source
async function scheduleNextScrape(ctx: any, sourceId: any) {
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
  const delayMs = 3 * 24 * 60 * 60 * 1000; // 3 days
  const scheduledId = await ctx.scheduler.runAfter(
    delayMs,
    internal.eventSources.performScheduledSourceScrape,
    { sourceId },
  );

  console.log(
    `⏰ Scheduled next scrape with ID: ${scheduledId}, delay: ${delayMs}ms (${Math.round(delayMs / (24 * 60 * 60 * 1000))} days)`,
  );

  // Update the source with the scheduled job info
  await ctx.db.patch(sourceId, {
    nextScrapeScheduledId: scheduledId,
    nextScrapeScheduledAt: Date.now() + delayMs,
  });

  console.log(
    `✅ Successfully scheduled next scrape for ${source.name} at ${new Date(Date.now() + delayMs).toISOString()}`,
  );
}

export const updateTestScrapeProgress = internalMutation({
  args: {
    testScrapeId: v.id("testScrapes"),
    progress: v.object({
      stage: v.string(),
      message: v.string(),
      eventsFound: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
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
  handler: async (ctx, args) => {
    await ctx.db.patch(args.testScrapeId, {
      status: args.result.success ? "completed" : "failed",
      result: args.result,
      completedAt: Date.now(),
    });
  },
});

export const clearScheduledScrape = internalMutation({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, {
      nextScrapeScheduledId: undefined,
      nextScrapeScheduledAt: undefined,
    });
  },
});

// Internal actions
export const performSourceScrape = internalAction({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    message: string;
    eventsFound?: number;
    data?: any;
  }> => {
    try {
      console.log(`🔍 Starting source scrape for sourceId: ${args.sourceId}`);

      // Get the source
      const source = await ctx.runQuery(internal.eventSources.getSourceById, {
        sourceId: args.sourceId,
      });

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
        internal.scraping.scrapeUrlInternal,
        {
          url: source.startingUrl,
        },
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
            `🔄 Processing event: ${eventData.title} (${eventData.url})`,
          );

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
            await ctx.runMutation(
              internal.events.eventsInternal.createInternal,
              {
                title: eventData.title,
                description:
                  eventData.description ||
                  `Event: ${eventData.title}. More details available at ${eventData.url}`,
                eventDate:
                  typeof eventData.eventDate === "string"
                    ? new Date(eventData.eventDate).getTime()
                    : eventData.eventDate,
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
          console.error(`❌ Failed to process event ${eventData.url}:`, error);
        }
      }

      // Update the source's last scrape time
      console.log(`🔄 Updating last scrape time for source: ${source.name}`);
      await ctx.runMutation(internal.eventSources.updateLastScrapeTime, {
        sourceId: args.sourceId,
        timestamp: Date.now(),
      });

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
      const errorMessage = `Failed to scrape source with id '${args.sourceId}': ${error instanceof Error ? error.message : "Unknown error"}`;
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
  handler: async (ctx, args) => {
    try {
      console.log(
        `🧪 Starting test scrape for testScrapeId: ${args.testScrapeId}`,
      );

      const testScrape = await ctx.runQuery(
        internal.eventSources.getTestScrapeById,
        {
          testScrapeId: args.testScrapeId,
        },
      );

      if (!testScrape) {
        throw new Error(`Test scrape with id '${args.testScrapeId}' not found`);
      }

      console.log(`✅ Found test scrape for URL: ${testScrape.url}`);

      // Update progress: fetching
      await ctx.runMutation(internal.eventSources.updateTestScrapeProgress, {
        testScrapeId: args.testScrapeId,
        progress: {
          stage: "fetching",
          message: "Fetching content from URL...",
        },
      });

      // Scrape the URL
      console.log(`🌐 Scraping URL: ${testScrape.url}`);
      const scrapeResult = await ctx.runAction(
        internal.scraping.scrapeUrlInternal,
        { url: testScrape.url },
      );

      if (!scrapeResult.success) {
        console.error(`❌ Scrape failed: ${scrapeResult.message}`);
        await ctx.runMutation(internal.eventSources.completeTestScrape, {
          testScrapeId: args.testScrapeId,
          result: {
            success: false,
            message: `Failed to scrape URL: ${scrapeResult.message}`,
          },
        });
        return;
      }

      // Update progress: extracting
      await ctx.runMutation(internal.eventSources.updateTestScrapeProgress, {
        testScrapeId: args.testScrapeId,
        progress: {
          stage: "extracting",
          message: "Extracting events from content...",
        },
      });

      // Extract events from scraped data
      const events = scrapeResult.data?.extractedEvents || [];
      console.log(`📝 Found ${events.length} potential events`);

      // Update progress: processing
      await ctx.runMutation(internal.eventSources.updateTestScrapeProgress, {
        testScrapeId: args.testScrapeId,
        progress: {
          stage: "processing",
          message: `Found ${events.length} potential events`,
          eventsFound: events.length,
        },
      });

      // Complete the test scrape
      const message = `Successfully scraped URL '${testScrape.url}'. Found ${events.length} potential events.`;
      console.log(`✅ ${message}`);

      await ctx.runMutation(internal.eventSources.completeTestScrape, {
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
      });
    } catch (error) {
      const errorMessage = `Failed to scrape URL: ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(
        `❌ Test scrape failed for testScrapeId: ${args.testScrapeId}`,
        error,
      );

      await ctx.runMutation(internal.eventSources.completeTestScrape, {
        testScrapeId: args.testScrapeId,
        result: {
          success: false,
          message: errorMessage,
        },
      });
    }
  },
});

// Internal queries
export const getTestScrapeById = internalQuery({
  args: {
    testScrapeId: v.id("testScrapes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.testScrapeId);
  },
});

// Public queries
export const getTestScrapeByIdPublic = adminQuery({
  args: {
    testScrapeId: v.id("testScrapes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.testScrapeId);
  },
});

// Query to fetch latest test scrapes for polling/subscription
export const listRecentTestScrapes = adminQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("testScrapes").order("desc").take(10);
  },
});

export const getSourcesStatus = adminQuery({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("eventSources").collect();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const activeSources = sources.filter((source) => source.isActive);
    const sourcesNeedingScraping = activeSources.filter(
      (source) => !source.dateLastScrape || source.dateLastScrape < oneDayAgo,
    );

    // Get recent scraping activity
    const recentlyScraped = activeSources
      .filter(
        (source) => source.dateLastScrape && source.dateLastScrape > oneDayAgo,
      )
      .sort((a, b) => (b.dateLastScrape || 0) - (a.dateLastScrape || 0));

    return {
      totalSources: sources.length,
      activeSources: activeSources.length,
      sourcesNeedingScraping: sourcesNeedingScraping.length,
      recentlyScraped: recentlyScraped
        .map((source) => ({
          id: source._id,
          name: source.name,
          lastScraped: source.dateLastScrape,
        }))
        .slice(0, 5),
      nextScrapingCandidates: sourcesNeedingScraping
        .map((source) => ({
          id: source._id,
          name: source.name,
          lastScraped: source.dateLastScrape,
          daysSinceLastScrape: source.dateLastScrape
            ? Math.floor((now - source.dateLastScrape) / (24 * 60 * 60 * 1000))
            : null,
        }))
        .slice(0, 5),
    };
  },
});

// Get events by source ID with pagination
export const getEventsBySource = adminQuery({
  args: {
    sourceId: v.id("eventSources"),
    paginationOpts: v.object({
      cursor: v.union(v.string(), v.null()),
      numItems: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Get events for this source, ordered by creation date (newest first)
    const events = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("sourceId"), args.sourceId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Get statistics about events from this source
    const allEventsFromSource = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("sourceId"), args.sourceId))
      .collect();

    const now = Date.now();
    const upcomingEvents = allEventsFromSource.filter(
      (event) => event.eventDate > now,
    );
    const pastEvents = allEventsFromSource.filter(
      (event) => event.eventDate <= now,
    );

    return {
      ...events,
      stats: {
        totalEvents: allEventsFromSource.length,
        upcomingEvents: upcomingEvents.length,
        pastEvents: pastEvents.length,
        oldestEvent:
          allEventsFromSource.length > 0
            ? Math.min(...allEventsFromSource.map((e) => e.eventDate))
            : null,
        newestEvent:
          allEventsFromSource.length > 0
            ? Math.max(...allEventsFromSource.map((e) => e.eventDate))
            : null,
      },
    };
  },
});

export const performScheduledSourceScrape = internalAction({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args) => {
    try {
      console.log(
        `⏰ Starting scheduled scrape for sourceId: ${args.sourceId}`,
      );

      // Get the source to verify it's still active
      const source = await ctx.runQuery(internal.eventSources.getSourceById, {
        sourceId: args.sourceId,
      });

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
        await ctx.runMutation(internal.eventSources.clearScheduledScrape, {
          sourceId: args.sourceId,
        });
        return;
      }

      console.log(
        `✅ Running scheduled scrape for active source: ${source.name}`,
      );

      // Perform the scrape using the existing scrape logic
      const result = await ctx.runAction(
        internal.eventSources.performSourceScrape,
        {
          sourceId: args.sourceId,
        },
      );

      if (result.success) {
        console.log(
          `✅ Scheduled scrape completed successfully for ${source.name}: ${result.message}`,
        );
      } else {
        console.error(
          `❌ Scheduled scrape failed for ${source.name}: ${result.message}`,
        );
      }

      // Clear the scheduled scrape info since this job is now complete
      // The performSourceScrape -> updateLastScrapeTime chain will schedule the next one
      await ctx.runMutation(internal.eventSources.clearScheduledScrape, {
        sourceId: args.sourceId,
      });
    } catch (error) {
      console.error(
        `💥 Error in scheduled source scrape for ${args.sourceId}:`,
        error,
      );

      // Clear the scheduled scrape info even on error to prevent stuck jobs
      await ctx.runMutation(internal.eventSources.clearScheduledScrape, {
        sourceId: args.sourceId,
      });
    }
  },
});
