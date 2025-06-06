import {
  query,
  mutation,
  action,
  internalAction,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Helper function to check if user is admin
async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be authenticated");
  }

  // Use internal query to check admin status
  const isAdmin = await ctx.runQuery(internal.eventsInternal.checkUserIsAdmin, {
    userId,
  });
  if (!isAdmin) {
    throw new Error("Admin access required");
  }
  return userId;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return await ctx.db.query("eventSources").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    startingUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    return await ctx.db.insert("eventSources", {
      name: args.name,
      startingUrl: args.startingUrl,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("eventSources"),
    name: v.optional(v.string()),
    startingUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    await ctx.db.patch(id, filteredUpdates);
  },
});

export const remove = mutation({
  args: {
    id: v.id("eventSources"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await ctx.db.delete(args.id);
  },
});

export const testScrape = action({
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
    await requireAdmin(ctx);

    const result: {
      success: boolean;
      message: string;
      eventsFound?: number;
      data?: any;
    } = await ctx.runAction(internal.eventSources.performSourceScrape, {
      sourceId: args.sourceId,
    });

    return result;
  },
});

export const startTestScrape = mutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

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
    await ctx.db.patch(args.sourceId, {
      dateLastScrape: args.timestamp,
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
      // Get the source
      const source = await ctx.runQuery(internal.eventSources.getSourceById, {
        sourceId: args.sourceId,
      });

      if (!source) {
        return {
          success: false,
          message: "Event source not found",
        };
      }

      // Scrape the source page - using the general URL scraping function for now
      // This would need to be implemented to handle source-specific scraping
      const scrapeResult: any = await ctx.runAction(
        internal.scraping.scrapeUrlInternal,
        {
          url: source.startingUrl,
        },
      );

      if (!scrapeResult.success) {
        return scrapeResult;
      }

      // For now, we'll return a placeholder response since we don't have source-specific scraping
      // In a real implementation, this would parse the scraped content to extract events
      const events: any[] = []; // Would be populated from scrapeResult.data.extractedEvents
      let eventsCreated = 0;

      // Process each event found
      for (const eventData of events) {
        try {
          // Check if event already exists
          const existingEvent = await ctx.runQuery(
            internal.eventsInternal.getEventByUrl,
            {
              url: eventData.url,
            },
          );

          if (!existingEvent) {
            // Create new event
            await ctx.runMutation(internal.eventsInternal.createInternal, {
              title: eventData.title,
              description: eventData.description,
              eventDate: eventData.eventDate,
              imageUrl: eventData.imageUrl,
              url: eventData.url,
              sourceId: args.sourceId,
            });
            eventsCreated++;
          }
        } catch (error) {
          console.error(`Failed to process event ${eventData.url}:`, error);
        }
      }

      // Update the source's last scrape time
      await ctx.runMutation(internal.eventSources.updateLastScrapeTime, {
        sourceId: args.sourceId,
        timestamp: Date.now(),
      });

      return {
        success: true,
        message: `Successfully scraped ${eventsCreated} new events from ${events.length} total events found`,
        eventsFound: eventsCreated,
        data: {
          totalEventsFound: events.length,
          newEventsCreated: eventsCreated,
        },
      };
    } catch (error) {
      console.error("Error performing source scrape:", error);
      return {
        success: false,
        message: `Failed to scrape source: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

export const performTestScrape = internalAction({
  args: {
    testScrapeId: v.id("testScrapes"),
  },
  handler: async (ctx: any, args) => {
    try {
      const testScrape = await ctx.runQuery(
        internal.eventSources.getTestScrapeById,
        {
          testScrapeId: args.testScrapeId,
        },
      );
      if (!testScrape) throw new Error("Test scrape not found");
      await ctx.runMutation(internal.eventSources.updateTestScrapeProgress, {
        testScrapeId: args.testScrapeId,
        progress: {
          stage: "fetching",
          message: "Fetching content from URL...",
        },
      });
      const scrapeResult = await ctx.runAction(
        internal.scraping.scrapeUrlInternal,
        { url: testScrape.url },
      );
      if (!scrapeResult.success) {
        await ctx.runMutation(internal.eventSources.completeTestScrape, {
          testScrapeId: args.testScrapeId,
          result: { success: false, message: scrapeResult.message },
        });
        return;
      }
      await ctx.runMutation(internal.eventSources.updateTestScrapeProgress, {
        testScrapeId: args.testScrapeId,
        progress: {
          stage: "extracting",
          message: "Extracting events from content...",
        },
      });
      const events =
        scrapeResult.data && scrapeResult.data.extractedEvents
          ? scrapeResult.data.extractedEvents
          : [];
      await ctx.runMutation(internal.eventSources.updateTestScrapeProgress, {
        testScrapeId: args.testScrapeId,
        progress: {
          stage: "processing",
          message: `Found ${events.length} potential events`,
          eventsFound: events.length,
        },
      });
      await ctx.runMutation(internal.eventSources.completeTestScrape, {
        testScrapeId: args.testScrapeId,
        result: {
          success: true,
          message: `Successfully scraped URL. Found ${events.length} potential events.`,
          eventsFound: events.length,
          data: {
            totalEventsFound: events.length,
            scrapedData: scrapeResult.data,
            extractedEvents: events,
          },
        },
      });
    } catch (error) {
      await ctx.runMutation(internal.eventSources.completeTestScrape, {
        testScrapeId: args.testScrapeId,
        result: {
          success: false,
          message: `Failed to scrape URL: ${error instanceof Error ? error.message : "Unknown error"}`,
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
export const getTestScrapeByIdPublic = query({
  args: {
    testScrapeId: v.id("testScrapes"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.testScrapeId);
  },
});

// Query to fetch latest test scrapes for polling/subscription
export const listRecentTestScrapes = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("testScrapes").order("desc").take(10);
  },
});
