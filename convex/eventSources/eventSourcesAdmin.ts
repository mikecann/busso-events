import { query, action, mutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { adminQuery, adminMutation, adminAction } from "../utils";
import {
  EventSourceData,
  EventSourceUpdateData,
  SourceScrapeResult,
  TestScrapeResult,
  SourceStatus,
  EventSourceStats,
  validateEventSourceData,
  validateEventSourceUpdateData,
  sanitizeSourceName,
  normalizeUrl,
  getInitialScrapeDelay,
} from "./common";
import { Doc, Id } from "../_generated/dataModel";

// ADMIN QUERIES

export const list = adminQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"eventSources">[]> => {
    return await ctx.db.query("eventSources").order("desc").collect();
  },
});

export const getById = adminQuery({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args): Promise<Doc<"eventSources"> | null> => {
    return await ctx.db.get(args.sourceId);
  },
});

export const getSourcesStatus = adminQuery({
  args: {},
  handler: async (ctx): Promise<SourceStatus> => {
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

    const stats: EventSourceStats = {
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
    };

    return {
      ...events,
      stats,
    };
  },
});

export const getTestScrapeById = adminQuery({
  args: {
    testScrapeId: v.id("testScrapes"),
  },
  handler: async (ctx, args): Promise<Doc<"testScrapes"> | null> => {
    return await ctx.db.get(args.testScrapeId);
  },
});

export const listRecentTestScrapes = adminQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"testScrapes">[]> => {
    return await ctx.db.query("testScrapes").order("desc").take(10);
  },
});

// ADMIN MUTATIONS

export const create = adminMutation({
  args: {
    name: v.string(),
    startingUrl: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"eventSources">> => {
    const sourceData: EventSourceData = {
      name: sanitizeSourceName(args.name),
      startingUrl: normalizeUrl(args.startingUrl),
      isActive: true,
    };

    validateEventSourceData(sourceData);

    const sourceId = await ctx.db.insert("eventSources", {
      name: sourceData.name,
      startingUrl: sourceData.startingUrl,
      isActive: true,
    });

    // Schedule first scrape for new source (5 minutes delay to allow immediate manual testing)
    const delayMs = getInitialScrapeDelay();

    try {
      const scheduledId = await ctx.scheduler.runAfter(
        delayMs,
        internal.eventSources.eventSourcesInternal.performScheduledSourceScrape,
        { sourceId },
      );

      // Update the source with the scheduled job info
      await ctx.db.patch(sourceId, {
        nextScrapeScheduledId: scheduledId,
        nextScrapeScheduledAt: Date.now() + delayMs,
      });

      console.log(
        `✅ Successfully created and scheduled source ${sourceData.name}`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to schedule initial scrape for newly created source ${sourceData.name}:`,
        error,
      );
      // Don't throw the error - the source creation should still succeed
      // The scheduling failure is logged and can be handled separately
      console.log(
        `⚠️ Source ${sourceId} created but initial scheduling failed - manual intervention may be needed`,
      );
    }

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
  handler: async (ctx, args): Promise<void> => {
    const { id, ...updates } = args;

    // Sanitize and validate updates
    const cleanUpdates: Partial<EventSourceUpdateData> = {};
    if (updates.name !== undefined) {
      cleanUpdates.name = sanitizeSourceName(updates.name);
    }
    if (updates.startingUrl !== undefined) {
      cleanUpdates.startingUrl = normalizeUrl(updates.startingUrl);
    }
    if (updates.isActive !== undefined) {
      cleanUpdates.isActive = updates.isActive;
    }

    validateEventSourceUpdateData(cleanUpdates);

    const filteredUpdates = Object.fromEntries(
      Object.entries(cleanUpdates).filter(([_, value]) => value !== undefined),
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
        try {
          await scheduleNextScrapeForSource(ctx, id);
          console.log(
            `✅ Successfully scheduled scrape for newly activated source: ${id}`,
          );
        } catch (error) {
          console.error(
            `❌ Failed to schedule scrape for newly activated source: ${id}`,
            error,
          );
          // Don't throw the error - the source activation should still succeed
          // The scheduling failure is logged and can be handled separately
          console.log(
            `⚠️ Source ${id} activated but scheduling failed - manual intervention may be needed`,
          );
        }
      }
    }
  },
});

export const remove = adminMutation({
  args: {
    id: v.id("eventSources"),
  },
  handler: async (ctx, args): Promise<void> => {
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

export const startTestScrape = adminMutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"testScrapes">> => {
    const testScrapeId = await ctx.runMutation(
      internal.eventSources.eventSourcesInternal.createTestScrape,
      {
        url: normalizeUrl(args.url),
      },
    );

    await ctx.scheduler.runAfter(
      0,
      internal.eventSources.eventSourcesInternal.performTestScrape,
      {
        testScrapeId,
      },
    );

    return testScrapeId;
  },
});

// ADMIN ACTIONS

export const testScrape = adminAction({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args): Promise<SourceScrapeResult> => {
    console.log(`🧪 Starting test scrape for sourceId: ${args.sourceId}`);

    try {
      const result: SourceScrapeResult = await ctx.runAction(
        internal.eventSources.eventSourcesInternal.performSourceScrape,
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

export const debugScheduleScrape = adminAction({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; message: string }> => {
    console.log(
      `🔧 Debug: Manually scheduling scrape for sourceId: ${args.sourceId}`,
    );

    try {
      await ctx.runMutation(
        internal.eventSources.eventSourcesInternal.updateLastScrapeTime,
        {
          sourceId: args.sourceId,
          timestamp: Date.now(),
        },
      );

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

export const forceScrapeNow = adminAction({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args): Promise<SourceScrapeResult> => {
    console.log(
      `🚀 Admin forcing immediate scrape for sourceId: ${args.sourceId}`,
    );

    try {
      const result: SourceScrapeResult = await ctx.runAction(
        internal.eventSources.eventSourcesInternal.performSourceScrape,
        {
          sourceId: args.sourceId,
        },
      );

      console.log(`🚀 Force scrape completed for sourceId: ${args.sourceId}`, {
        success: result.success,
        eventsFound: result.eventsFound,
      });

      return result;
    } catch (error) {
      const errorMessage = `Force scrape failed for sourceId '${args.sourceId}': ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(`❌ ${errorMessage}`);

      return {
        success: false,
        message: errorMessage,
      };
    }
  },
});

export const fixMissingSourceSchedules = adminAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    sourcesFixed: number;
    sourcesChecked: number;
    sources: Array<{
      id: string;
      name: string;
      scheduled: boolean;
      error?: string;
    }>;
  }> => {
    console.log("🔧 Admin: Starting to fix missing source schedules");

    const sources = await ctx.runQuery(
      internal.eventSources.eventSourcesInternal.getActiveSources,
    );

    let sourcesFixed = 0;
    let sourcesChecked = 0;
    const results: Array<{
      id: string;
      name: string;
      scheduled: boolean;
      error?: string;
    }> = [];

    for (const source of sources) {
      sourcesChecked++;
      console.log(`🔍 Checking source: ${source.name} (ID: ${source._id})`);

      // Check if active source is missing scheduled scrape
      if (!source.nextScrapeScheduledId) {
        console.log(`📅 Fixing missing schedule for source: ${source.name}`);

        try {
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
              console.log(
                `⏰ Source ${source.name} is overdue, scheduling immediately`,
              );
            } else {
              // Schedule for the calculated time
              delayMs = threeDaysAfterLastScrape - now;
              console.log(
                `⏰ Source ${source.name} scheduled for ${new Date(threeDaysAfterLastScrape).toISOString()}`,
              );
            }
          } else {
            // Never scraped, schedule for 5 minutes from now
            delayMs = 5 * 60 * 1000;
            console.log(
              `⏰ Source ${source.name} never scraped, scheduling for 5 minutes from now`,
            );
          }

          // Schedule the scrape
          const scheduledId = await ctx.scheduler.runAfter(
            delayMs,
            internal.eventSources.eventSourcesInternal
              .performScheduledSourceScrape,
            { sourceId: source._id },
          );

          // Update the source with the scheduled job info
          await ctx.runMutation(
            internal.eventSources.eventSourcesInternal.updateSchedulingInfo,
            {
              sourceId: source._id,
              nextScrapeScheduledId: scheduledId,
              nextScrapeScheduledAt: Date.now() + delayMs,
            },
          );

          sourcesFixed++;
          results.push({
            id: source._id,
            name: source.name,
            scheduled: true,
          });

          console.log(`✅ Successfully scheduled scrape for ${source.name}`);
        } catch (error) {
          console.error(
            `❌ Failed to schedule scrape for ${source.name}:`,
            error,
          );
          results.push({
            id: source._id,
            name: source.name,
            scheduled: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } else {
        console.log(`✅ Source ${source.name} already has a scheduled scrape`);
        results.push({
          id: source._id,
          name: source.name,
          scheduled: true,
        });
      }
    }

    console.log(
      `🔧 Admin: Fixed ${sourcesFixed} out of ${sourcesChecked} sources`,
    );

    return {
      sourcesFixed,
      sourcesChecked,
      sources: results,
    };
  },
});

// Helper function to schedule next scrape for a source (used in mutations)
async function scheduleNextScrapeForSource(
  ctx: any,
  sourceId: Id<"eventSources">,
): Promise<void> {
  try {
    const delayMs = getInitialScrapeDelay(); // Use initial delay for newly activated sources

    let scheduledId;
    try {
      scheduledId = await ctx.scheduler.runAfter(
        delayMs,
        internal.eventSources.eventSourcesInternal.performScheduledSourceScrape,
        { sourceId },
      );
      console.log(
        `⏰ Scheduled scrape for source ${sourceId} with ID: ${scheduledId}, delay: ${delayMs}ms`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to schedule scrape for source ${sourceId}:`,
        error,
      );
      throw new Error(
        `Failed to schedule scrape for source '${sourceId}': ${error instanceof Error ? error.message : "Unknown scheduler error"}`,
      );
    }

    try {
      await ctx.db.patch(sourceId, {
        nextScrapeScheduledId: scheduledId,
        nextScrapeScheduledAt: Date.now() + delayMs,
      });
      console.log(
        `✅ Successfully updated source ${sourceId} with scheduling info`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to update source ${sourceId} with scheduling info:`,
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
        `Failed to update source '${sourceId}' with scheduling info: ${error instanceof Error ? error.message : "Unknown database error"}`,
      );
    }
  } catch (error) {
    console.error(
      `💥 Critical error in scheduleNextScrapeForSource for sourceId ${sourceId}:`,
      error,
    );
    // Re-throw the error so calling code can handle it appropriately
    throw error;
  }
}
