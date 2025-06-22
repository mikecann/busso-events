import { v } from "convex/values";
import { internal } from "../_generated/api";
import { validateEventData } from "./common";
import { adminQuery, adminMutation, adminAction } from "../utils";
import { Doc } from "../_generated/dataModel";

export const getEventsReadyForScraping = adminQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"events">[]> => {
    return await ctx.runQuery(
      internal.events.eventsInternal.getEventsReadyForScrapingInternal,
    );
  },
});

export const updateEvent = adminMutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    eventDate: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { id, ...updates } = args;

    // Validate the update data
    validateEventData(updates);

    await ctx.runMutation(internal.events.eventsInternal.updateEventInternal, {
      eventId: id,
      ...updates,
    });
  },
});

export const deleteEvent = adminMutation({
  args: {
    id: v.id("events"),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runMutation(internal.events.eventsInternal.deleteEventInternal, {
      eventId: args.id,
    });
  },
});

export const scrapeEvent = adminAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    message: string;
    scrapedData?: unknown;
  }> => {
    return await ctx.runAction(
      internal.events.eventsInternal.performEventScrape,
      {
        eventId: args.eventId,
      },
    );
  },
});

export const getSchedulingInfo = adminQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get events with workpool subscription matching jobs
    const eventsWithQueuedMatching = await ctx.db
      .query("events")
      .filter((q) => q.neq(q.field("subscriptionMatchWorkId"), undefined))
      .collect();

    // For workpool jobs, we can't easily determine "upcoming vs overdue" without checking each status
    // So we'll just report total queued jobs and provide basic stats
    const totalQueuedMatching = eventsWithQueuedMatching.length;

    // Get a sample of events for the next matches display
    const nextMatches = eventsWithQueuedMatching
      .filter((event) => event.subscriptionMatchEnqueuedAt)
      .sort(
        (a, b) =>
          (a.subscriptionMatchEnqueuedAt || 0) -
          (b.subscriptionMatchEnqueuedAt || 0),
      )
      .slice(0, 5);

    return {
      totalScheduledMatching: totalQueuedMatching,
      upcomingMatching: totalQueuedMatching, // All queued jobs are considered "upcoming"
      overdueMatching: 0, // Workpool handles this internally
      nextMatches: nextMatches.map((event) => ({
        eventId: event._id,
        title: event.title,
        scheduledAt: event.subscriptionMatchEnqueuedAt, // This is when it was enqueued
      })),
    };
  },
});

export const getWorkpoolsStatus = adminQuery({
  args: {},
  handler: async (ctx) => {
    // Get counts of events with workpool jobs for each workpool type
    const eventsWithScrapeJobs = await ctx.db
      .query("events")
      .filter((q) => q.neq(q.field("scrapeWorkId"), undefined))
      .collect();

    const eventsWithEmbeddingJobs = await ctx.db
      .query("events")
      .filter((q) => q.neq(q.field("embeddingWorkId"), undefined))
      .collect();

    const eventsWithSubscriptionMatchJobs = await ctx.db
      .query("events")
      .filter((q) => q.neq(q.field("subscriptionMatchWorkId"), undefined))
      .collect();

    return {
      eventScrapeWorkpool: {
        name: "Event Scraping",
        description: "Scrapes event details from URLs",
        maxParallelism: 1,
        queuedJobs: eventsWithScrapeJobs.length,
        recentJobs: eventsWithScrapeJobs
          .sort((a, b) => (b.scrapeEnqueuedAt || 0) - (a.scrapeEnqueuedAt || 0))
          .slice(0, 5)
          .map((event) => ({
            eventId: event._id,
            eventTitle: event.title,
            enqueuedAt: event.scrapeEnqueuedAt,
          })),
      },
      eventEmbeddingWorkpool: {
        name: "Embedding Generation",
        description: "Generates vector embeddings for semantic search",
        maxParallelism: 2,
        queuedJobs: eventsWithEmbeddingJobs.length,
        recentJobs: eventsWithEmbeddingJobs
          .sort(
            (a, b) =>
              (b.embeddingEnqueuedAt || 0) - (a.embeddingEnqueuedAt || 0),
          )
          .slice(0, 5)
          .map((event) => ({
            eventId: event._id,
            eventTitle: event.title,
            enqueuedAt: event.embeddingEnqueuedAt,
          })),
      },
      subscriptionMatchWorkpool: {
        name: "Subscription Matching",
        description: "Matches events against user subscriptions",
        maxParallelism: 1,
        queuedJobs: eventsWithSubscriptionMatchJobs.length,
        recentJobs: eventsWithSubscriptionMatchJobs
          .sort(
            (a, b) =>
              (b.subscriptionMatchEnqueuedAt || 0) -
              (a.subscriptionMatchEnqueuedAt || 0),
          )
          .slice(0, 5)
          .map((event) => ({
            eventId: event._id,
            eventTitle: event.title,
            enqueuedAt: event.subscriptionMatchEnqueuedAt,
          })),
      },
    };
  },
});

export const clearWorkpoolJobs = adminAction({
  args: {
    workpoolType: v.union(
      v.literal("eventScrapeWorkpool"),
      v.literal("eventEmbeddingWorkpool"),
      v.literal("subscriptionMatchWorkpool"),
    ),
  },
  handler: async (ctx, args) => {
    let clearedCount = 0;
    let failedCount = 0;

    if (args.workpoolType === "eventScrapeWorkpool") {
      // Get all events with scrape work IDs
      const eventsWithScrapeJobs = await ctx.runQuery(
        internal.events.eventsInternal.getEventsWithScrapeJobs,
      );

      for (const event of eventsWithScrapeJobs) {
        if (event.scrapeWorkId) {
          try {
            // Cancel the workpool job
            await ctx.runMutation(
              internal.events.eventsInternal.cancelEventScrapeJob,
              { eventId: event._id },
            );
            clearedCount++;
          } catch (error) {
            console.error(
              `Failed to cancel scrape job for event ${event._id}:`,
              error,
            );
            failedCount++;
          }
        }
      }
    } else if (args.workpoolType === "eventEmbeddingWorkpool") {
      // Get all events with embedding work IDs
      const eventsWithEmbeddingJobs = await ctx.runQuery(
        internal.events.eventsInternal.getEventsWithEmbeddingJobs,
      );

      for (const event of eventsWithEmbeddingJobs) {
        if (event.embeddingWorkId) {
          try {
            // Cancel the workpool job
            await ctx.runMutation(
              internal.events.eventsInternal.cancelEventEmbeddingJob,
              { eventId: event._id },
            );
            clearedCount++;
          } catch (error) {
            console.error(
              `Failed to cancel embedding job for event ${event._id}:`,
              error,
            );
            failedCount++;
          }
        }
      }
    } else if (args.workpoolType === "subscriptionMatchWorkpool") {
      // Get all events with subscription match work IDs
      const eventsWithSubscriptionMatchJobs = await ctx.runQuery(
        internal.events.eventsInternal.getEventsWithSubscriptionMatchJobs,
      );

      for (const event of eventsWithSubscriptionMatchJobs) {
        if (event.subscriptionMatchWorkId) {
          try {
            // Cancel the workpool job
            await ctx.runMutation(
              internal.events.eventsInternal.cancelEventSubscriptionMatchJob,
              { eventId: event._id },
            );
            clearedCount++;
          } catch (error) {
            console.error(
              `Failed to cancel subscription match job for event ${event._id}:`,
              error,
            );
            failedCount++;
          }
        }
      }
    }

    return {
      success: true,
      message: `Cleared ${clearedCount} jobs from ${args.workpoolType}`,
      clearedCount,
      failedCount,
    };
  },
});

export const getWorkpoolDetailedStatus = adminQuery({
  args: {
    workpoolType: v.union(
      v.literal("eventScrapeWorkpool"),
      v.literal("eventEmbeddingWorkpool"),
      v.literal("subscriptionMatchWorkpool"),
    ),
  },
  handler: async (ctx, args) => {
    let events: Doc<"events">[] = [];
    let workpoolName = "";
    let description = "";
    let maxParallelism = 1;

    if (args.workpoolType === "eventScrapeWorkpool") {
      events = await ctx.runQuery(
        internal.events.eventsInternal.getEventsWithScrapeJobs,
      );
      workpoolName = "Event Scraping";
      description =
        "Scrapes event details from URLs to enhance event information";
      maxParallelism = 1;
    } else if (args.workpoolType === "eventEmbeddingWorkpool") {
      events = await ctx.runQuery(
        internal.events.eventsInternal.getEventsWithEmbeddingJobs,
      );
      workpoolName = "Embedding Generation";
      description =
        "Generates vector embeddings for semantic search and subscription matching";
      maxParallelism = 2;
    } else if (args.workpoolType === "subscriptionMatchWorkpool") {
      events = await ctx.runQuery(
        internal.events.eventsInternal.getEventsWithSubscriptionMatchJobs,
      );
      workpoolName = "Subscription Matching";
      description =
        "Matches events against user subscriptions for email notifications";
      maxParallelism = 1;
    }

    // Get detailed job information
    const jobDetails = events.map((event) => {
      let workId: string | undefined;
      let enqueuedAt: number | undefined;

      if (args.workpoolType === "eventScrapeWorkpool") {
        workId = event.scrapeWorkId;
        enqueuedAt = event.scrapeEnqueuedAt;
      } else if (args.workpoolType === "eventEmbeddingWorkpool") {
        workId = event.embeddingWorkId;
        enqueuedAt = event.embeddingEnqueuedAt;
      } else if (args.workpoolType === "subscriptionMatchWorkpool") {
        workId = event.subscriptionMatchWorkId;
        enqueuedAt = event.subscriptionMatchEnqueuedAt;
      }

      return {
        eventId: event._id,
        eventTitle: event.title,
        eventUrl: event.url,
        eventDate: event.eventDate,
        workId,
        enqueuedAt,
      };
    });

    // Sort by enqueued time (most recent first)
    jobDetails.sort((a, b) => (b.enqueuedAt || 0) - (a.enqueuedAt || 0));

    return {
      workpoolType: args.workpoolType,
      name: workpoolName,
      description,
      maxParallelism,
      totalJobs: jobDetails.length,
      jobs: jobDetails,
    };
  },
});

export const deleteAllEvents = adminAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    success: boolean;
    message: string;
    deletedCount: number;
    failedCount: number;
    totalEvents: number;
  }> => {
    console.log("🗑️ Starting delete all events operation");

    // Get all events
    const allEvents = await ctx.runQuery(
      internal.events.eventsInternal.getAllEventsInternal,
    );
    console.log(`📊 Found ${allEvents.length} events to delete`);

    let deletedCount = 0;
    let failedCount = 0;

    // Delete events in batches to avoid timeout
    for (const event of allEvents) {
      try {
        await ctx.runMutation(
          internal.events.eventsInternal.deleteEventInternal,
          {
            eventId: event._id,
          },
        );
        deletedCount++;

        // Log progress every 100 deletions
        if (deletedCount % 100 === 0) {
          console.log(
            `📈 Progress: ${deletedCount}/${allEvents.length} events deleted`,
          );
        }
      } catch (error) {
        console.error(`❌ Failed to delete event ${event._id}:`, error);
        failedCount++;
      }
    }

    console.log(
      `✅ Delete all events completed: ${deletedCount} deleted, ${failedCount} failed`,
    );

    return {
      success: true,
      message: `Deleted ${deletedCount} events`,
      deletedCount,
      failedCount,
      totalEvents: allEvents.length,
    };
  },
});

export const clearAllWorkpools = adminAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    success: boolean;
    message: string;
    totalCleared: number;
    totalFailed: number;
    results: {
      eventScrapeWorkpool: { clearedCount: number; failedCount: number };
      eventEmbeddingWorkpool: { clearedCount: number; failedCount: number };
      subscriptionMatchWorkpool: { clearedCount: number; failedCount: number };
    };
  }> => {
    console.log("🧹 Starting clear all workpools operation");

    let totalCleared = 0;
    let totalFailed = 0;

    const results = {
      eventScrapeWorkpool: { clearedCount: 0, failedCount: 0 },
      eventEmbeddingWorkpool: { clearedCount: 0, failedCount: 0 },
      subscriptionMatchWorkpool: { clearedCount: 0, failedCount: 0 },
    };

    // Clear Event Scraping Workpool
    console.log("🧹 Clearing event scrape workpool...");
    const eventsWithScrapeJobs = await ctx.runQuery(
      internal.events.eventsInternal.getEventsWithScrapeJobs,
    );

    for (const event of eventsWithScrapeJobs) {
      if (event.scrapeWorkId) {
        try {
          await ctx.runMutation(
            internal.events.eventsInternal.cancelEventScrapeJob,
            { eventId: event._id },
          );
          results.eventScrapeWorkpool.clearedCount++;
          totalCleared++;
        } catch (error) {
          console.error(
            `Failed to cancel scrape job for event ${event._id}:`,
            error,
          );
          results.eventScrapeWorkpool.failedCount++;
          totalFailed++;
        }
      }
    }

    // Clear Embedding Generation Workpool
    console.log("🧹 Clearing embedding workpool...");
    const eventsWithEmbeddingJobs = await ctx.runQuery(
      internal.events.eventsInternal.getEventsWithEmbeddingJobs,
    );

    for (const event of eventsWithEmbeddingJobs) {
      if (event.embeddingWorkId) {
        try {
          await ctx.runMutation(
            internal.events.eventsInternal.cancelEventEmbeddingJob,
            { eventId: event._id },
          );
          results.eventEmbeddingWorkpool.clearedCount++;
          totalCleared++;
        } catch (error) {
          console.error(
            `Failed to cancel embedding job for event ${event._id}:`,
            error,
          );
          results.eventEmbeddingWorkpool.failedCount++;
          totalFailed++;
        }
      }
    }

    // Clear Subscription Matching Workpool
    console.log("🧹 Clearing subscription match workpool...");
    const eventsWithSubscriptionMatchJobs = await ctx.runQuery(
      internal.events.eventsInternal.getEventsWithSubscriptionMatchJobs,
    );

    for (const event of eventsWithSubscriptionMatchJobs) {
      if (event.subscriptionMatchWorkId) {
        try {
          await ctx.runMutation(
            internal.events.eventsInternal.cancelEventSubscriptionMatchJob,
            { eventId: event._id },
          );
          results.subscriptionMatchWorkpool.clearedCount++;
          totalCleared++;
        } catch (error) {
          console.error(
            `Failed to cancel subscription match job for event ${event._id}:`,
            error,
          );
          results.subscriptionMatchWorkpool.failedCount++;
          totalFailed++;
        }
      }
    }

    console.log(
      `✅ Clear all workpools completed: ${totalCleared} jobs cleared, ${totalFailed} failed`,
    );

    return {
      success: true,
      message: `Cleared ${totalCleared} jobs from all workpools`,
      totalCleared,
      totalFailed,
      results,
    };
  },
});
