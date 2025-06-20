import {
  internalQuery,
  internalMutation,
  internalAction,
  MutationCtx,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { components } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import {
  Workpool,
  WorkId,
  vWorkIdValidator,
  vResultValidator,
} from "@convex-dev/workpool";
import {
  EventScrapeResult,
  convertEventDetailsToScrapedData,
  selectBestImageUrl,
} from "./common";

// Initialize the workpool for event scraping with max parallelism of 1
const eventScrapePool = new Workpool(components.eventScrapeWorkpool, {
  maxParallelism: 1,
});

// Initialize the workpool for embedding generation with max parallelism of 2
const eventEmbeddingPool = new Workpool(components.eventEmbeddingWorkpool, {
  maxParallelism: 2, // Allow 2 concurrent embedding generations
});

export const getEventById = internalQuery({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});

export const getEventByUrl = internalQuery({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();
  },
});

export const checkUserIsAdmin = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.isAdmin === true;
  },
});

export const getEventsReadyForScrapingInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Get events that haven't been scraped in the last 24 hours
    return await ctx.db
      .query("events")
      .filter((q) =>
        q.or(
          q.eq(q.field("lastScraped"), undefined),
          q.lt(q.field("lastScraped"), oneDayAgo),
        ),
      )
      .collect();
  },
});

export const createInternal = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    eventDate: v.number(),
    imageUrl: v.string(),
    url: v.string(),
    sourceId: v.optional(v.id("eventSources")),
  },
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert("events", {
      title: args.title,
      description: args.description,
      eventDate: args.eventDate,
      imageUrl: args.imageUrl,
      url: args.url,
      sourceId: args.sourceId,
    });

    // Enqueue event scraping in workpool
    // The onComplete handler will take care of embedding generation and subscription matching
    await enqueueEventScraping(ctx, eventId);

    return eventId;
  },
});

export const updateEventAfterScrape = internalMutation({
  args: {
    eventId: v.id("events"),
    scrapedData: v.object({
      originalEventDate: v.optional(v.string()),
      location: v.optional(v.string()),
      organizer: v.optional(v.string()),
      price: v.optional(v.string()),
      category: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      registrationUrl: v.optional(v.string()),
      contactInfo: v.optional(v.string()),
      additionalDetails: v.optional(v.string()),
    }),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      lastScraped: Date.now(),
      scrapedData: args.scrapedData,
    };

    if (args.description) {
      updates.description = args.description;
    }

    if (args.imageUrl) {
      updates.imageUrl = args.imageUrl;
    }

    await ctx.db.patch(args.eventId, updates);

    // Note: Embedding generation and subscription matching are now handled
    // by the workpool onComplete callback for proper sequencing
  },
});

export const createEventInternal = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    eventDate: v.number(),
    imageUrl: v.string(),
    url: v.string(),
    sourceId: v.optional(v.id("eventSources")),
  },
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert("events", {
      title: args.title,
      description: args.description,
      eventDate: args.eventDate,
      imageUrl: args.imageUrl,
      url: args.url,
      sourceId: args.sourceId,
    });

    // Enqueue event scraping in workpool
    // The onComplete handler will take care of embedding generation and subscription matching
    await enqueueEventScraping(ctx, eventId);

    return eventId;
  },
});

// Helper function to schedule subscription matching for an event
async function scheduleSubscriptionMatching(ctx: any, eventId: any) {
  const event = await ctx.db.get(eventId);
  if (!event) return;

  // Cancel any existing scheduled matching for this event
  if (event.subscriptionMatchScheduledId) {
    try {
      await ctx.scheduler.cancel(event.subscriptionMatchScheduledId);
    } catch (error) {
      // Ignore errors if the job was already completed or doesn't exist
      console.log("Could not cancel existing subscription match job:", error);
    }
  }

  // Schedule new subscription matching in 8 hours
  const delayMs = 8 * 60 * 60 * 1000; // 8 hours
  const scheduledId = await ctx.scheduler.runAfter(
    delayMs,
    internal.subscriptionMatching.processEventForSubscriptionMatching,
    { eventId },
  );

  // Update the event with the scheduled job info
  await ctx.db.patch(eventId, {
    subscriptionMatchScheduledId: scheduledId,
    subscriptionMatchScheduledAt: Date.now() + delayMs,
  });
}

export const updateEventInternal = internalMutation({
  args: {
    eventId: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    eventDate: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { eventId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(eventId, filteredUpdates);

      // If description or title changed, reschedule subscription matching
      if (updates.description || updates.title) {
        await scheduleSubscriptionMatching(ctx, eventId);
      }
    }
  },
});

export const deleteEventInternal = internalMutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return;

    // Cancel any scheduled subscription matching
    if (event.subscriptionMatchScheduledId) {
      try {
        await ctx.scheduler.cancel(event.subscriptionMatchScheduledId);
      } catch (error) {
        console.log("Could not cancel subscription match job:", error);
      }
    }

    // Cancel any workpool event scraping
    if (event.scrapeWorkId) {
      try {
        await eventScrapePool.cancel(ctx, event.scrapeWorkId as WorkId);
      } catch (error) {
        console.log("Could not cancel workpool scrape job:", error);
      }
    }

    // Cancel any workpool embedding generation
    if (event.embeddingWorkId) {
      try {
        await eventEmbeddingPool.cancel(ctx, event.embeddingWorkId as WorkId);
      } catch (error) {
        console.log("Could not cancel workpool embedding job:", error);
      }
    }

    // Delete related email queue items
    const queueItems = await ctx.db
      .query("emailQueue")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    for (const item of queueItems) {
      await ctx.db.delete(item._id);
    }

    // Delete the event
    await ctx.db.delete(args.eventId);
  },
});

// Real scraping action that actually scrapes the event URL
export const performEventScrape = internalAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<EventScrapeResult> => {
    try {
      console.log(`🔍 Starting event scrape for eventId: ${args.eventId}`);

      // Get the event
      const event: any = await ctx.runQuery(
        internal.events.eventsInternal.getEventById,
        {
          eventId: args.eventId,
        },
      );

      if (!event) {
        console.error(`❌ Event not found: ${args.eventId}`);
        return {
          success: false,
          message: `Event with id '${args.eventId}' not found`,
        };
      }

      if (!event.url) {
        console.error(`❌ Event has no URL to scrape: ${args.eventId}`);
        return {
          success: false,
          message: "Event has no URL to scrape",
        };
      }

      console.log(`✅ Found event: ${event.title} (${event.url})`);

      // Scrape the event page using the event page scraping function
      console.log(`🌐 Scraping event URL: ${event.url}`);
      const scrapeResult = await ctx.runAction(
        internal.scraping.scrapeEventPageInternal,
        {
          url: event.url,
        },
      );

      if (!scrapeResult.success) {
        console.error(`❌ Scrape failed: ${scrapeResult.message}`);
        return {
          success: false,
          message: `Failed to scrape event URL: ${scrapeResult.message}`,
        };
      }

      console.log(
        `✅ Scrape successful, content length: ${scrapeResult.data?.contentLength || 0}`,
      );

      // Extract the event details from the scraped data
      const eventDetails: any = scrapeResult.data?.eventDetails || {};
      console.log(`📝 Extracted event details:`, eventDetails);

      // Convert the extracted event details to the format expected by scrapedData
      const scrapedData = convertEventDetailsToScrapedData(
        eventDetails,
        event.url,
      );

      // Extract the best image URL from the scraped data
      const bestImageUrl =
        eventDetails.imageUrls && Array.isArray(eventDetails.imageUrls)
          ? selectBestImageUrl(eventDetails.imageUrls)
          : undefined;

      if (bestImageUrl) {
        console.log(`🖼️ Selected image URL: ${bestImageUrl}`);
      }

      // Update the event with scraped data
      await ctx.runMutation(
        internal.events.eventsInternal.updateEventAfterScrape,
        {
          eventId: args.eventId,
          scrapedData,
          // Enhance description if we got additional details
          description: eventDetails.description
            ? eventDetails.description
            : event.description,
          // Update image URL if we found a good one
          imageUrl: bestImageUrl,
        },
      );

      const message = `Successfully scraped event '${event.title}' from URL: ${event.url}`;
      console.log(`✅ ${message}`);

      return {
        success: true,
        message,
        scrapedData,
      };
    } catch (error) {
      const errorMessage = `Failed to scrape event: ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(
        `❌ Event scrape failed for eventId: ${args.eventId}`,
        error,
      );
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      // Always clear the workpool job ID when the job completes (success or failure)
      try {
        await ctx.runMutation(
          internal.events.eventsInternal.clearEventScrapeSchedule,
          {
            eventId: args.eventId,
          },
        );
      } catch (clearError) {
        console.error("Failed to clear scrape workpool job ID:", clearError);
      }
    }
  },
});

// Enqueue event scraping in workpool with completion handler
async function enqueueEventScraping(
  ctx: MutationCtx,
  eventId: Id<"events">,
): Promise<string> {
  console.log(`🔍 Enqueueing event scraping for event ${eventId} in workpool`);

  // Enqueue the scraping action in the workpool with onComplete handler
  const workId = await eventScrapePool.enqueueAction(
    ctx,
    internal.events.eventsInternal.performEventScrape,
    { eventId },
    {
      onComplete: internal.events.eventsInternal.onScrapeComplete,
      context: { eventId },
    },
  );

  // Update the event with the workpool job ID and enqueue time
  await ctx.db.patch(eventId, {
    scrapeWorkId: workId,
    scrapeEnqueuedAt: Date.now(),
  });

  return workId;
}

// Workpool completion handler for scraping
export const onScrapeComplete = internalMutation({
  args: {
    workId: vWorkIdValidator,
    result: vResultValidator,
    context: v.object({
      eventId: v.id("events"),
    }),
  },
  handler: async (ctx, args) => {
    console.log(
      `🔍 Scrape completed for event ${args.context.eventId} with result: ${args.result.kind}`,
    );

    // Only enqueue embedding generation if scraping was successful
    if (args.result.kind === "success") {
      console.log(
        `✅ Scraping successful, enqueueing embedding generation for event ${args.context.eventId}`,
      );
      await enqueueEmbeddingGeneration(ctx, args.context.eventId);
    } else {
      console.log(
        `❌ Scraping failed or was canceled for event ${args.context.eventId}, enqueueing delayed embedding generation as fallback`,
      );
      // Still enqueue delayed embedding generation as fallback
      await enqueueEmbeddingGenerationDelayed(ctx, args.context.eventId);
    }

    // Schedule subscription matching for this event (8 hours delay)
    await scheduleSubscriptionMatching(ctx, args.context.eventId);
  },
});

// Clear the workpool scrape job ID
export const clearEventScrapeSchedule = internalMutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, {
      scrapeWorkId: undefined,
      scrapeEnqueuedAt: undefined,
    });
  },
});

// Enqueue embedding generation for an event
async function enqueueEmbeddingGeneration(
  ctx: MutationCtx,
  eventId: Id<"events">,
): Promise<string> {
  console.log(`🧠 Enqueueing embedding generation for event ${eventId}`);

  const workId = await eventEmbeddingPool.enqueueAction(
    ctx,
    internal.events.eventsInternal.performWorkpoolEmbeddingGeneration,
    { eventId },
  );

  // Update the event with the work ID and enqueue time
  await ctx.db.patch(eventId, {
    embeddingWorkId: workId,
    embeddingEnqueuedAt: Date.now(),
  });

  return workId;
}

// Enqueue delayed embedding generation for newly created events (fallback)
async function enqueueEmbeddingGenerationDelayed(
  ctx: MutationCtx,
  eventId: Id<"events">,
): Promise<string> {
  console.log(
    `🧠 Enqueueing delayed embedding generation for event ${eventId}`,
  );

  const workId = await eventEmbeddingPool.enqueueAction(
    ctx,
    internal.events.eventsInternal.performWorkpoolEmbeddingGeneration,
    { eventId },
  );

  // Update the event with the work ID and enqueue time
  await ctx.db.patch(eventId, {
    embeddingWorkId: workId,
    embeddingEnqueuedAt: Date.now(),
  });

  return workId;
}

// Workpool function to perform embedding generation
export const performWorkpoolEmbeddingGeneration = internalAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    message: string;
  }> => {
    console.log(
      `🧠 Starting workpool embedding generation for event ${args.eventId}`,
    );

    try {
      // Check if event already has an embedding to avoid duplicate work
      const event = await ctx.runQuery(
        internal.events.eventsInternal.getEventById,
        {
          eventId: args.eventId,
        },
      );

      if (!event) {
        console.log(
          `❌ Event ${args.eventId} not found during embedding generation`,
        );
        return {
          success: false,
          message: `Event ${args.eventId} not found`,
        };
      }

      if (event.descriptionEmbedding) {
        console.log(
          `✅ Event ${args.eventId} already has an embedding, skipping`,
        );
        return {
          success: true,
          message: `Event ${args.eventId} already has an embedding`,
        };
      }

      // Generate the embedding
      const result = await ctx.runAction(
        internal.embeddings.generateEventDescriptionEmbedding,
        {
          eventId: args.eventId,
        },
      );

      console.log(
        `✅ Workpool embedding generation completed for event ${args.eventId}:`,
        result,
      );
      return {
        success: result.success,
        message: `Successfully generated embedding for event ${args.eventId}`,
      };
    } catch (error) {
      console.error(
        `❌ Workpool embedding generation failed for event ${args.eventId}:`,
        error,
      );
      return {
        success: false,
        message: `Workpool embedding generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    } finally {
      // Always clear the workpool job ID when the job completes (success or failure)
      try {
        await ctx.runMutation(
          internal.events.eventsInternal.clearEmbeddingGenerationSchedule,
          {
            eventId: args.eventId,
          },
        );
      } catch (clearError) {
        console.error("Failed to clear embedding workpool job ID:", clearError);
      }
    }
  },
});

// Clear the workpool embedding generation job ID
export const clearEmbeddingGenerationSchedule = internalMutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, {
      embeddingWorkId: undefined,
      embeddingEnqueuedAt: undefined,
    });
  },
});

// Get workpool status for an event
export const getEventWorkpoolStatus = internalQuery({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event?.scrapeWorkId) {
      return null;
    }

    try {
      const status = await eventScrapePool.status(
        ctx,
        event.scrapeWorkId as WorkId,
      );
      return {
        workId: event.scrapeWorkId,
        enqueuedAt: event.scrapeEnqueuedAt,
        status,
      };
    } catch (error) {
      console.error("Error getting workpool status:", error);
      return {
        workId: event.scrapeWorkId,
        enqueuedAt: event.scrapeEnqueuedAt,
        status: null,
        error: "Failed to get status",
      };
    }
  },
});

// Get embedding workpool status for an event
export const getEventEmbeddingWorkpoolStatus = internalQuery({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event?.embeddingWorkId) {
      return null;
    }

    try {
      const status = await eventEmbeddingPool.status(
        ctx,
        event.embeddingWorkId as WorkId,
      );
      return {
        workId: event.embeddingWorkId,
        enqueuedAt: event.embeddingEnqueuedAt,
        status,
      };
    } catch (error) {
      console.error("Error getting embedding workpool status:", error);
      return {
        workId: event.embeddingWorkId,
        enqueuedAt: event.embeddingEnqueuedAt,
        status: null,
        error: "Failed to get status",
      };
    }
  },
});
