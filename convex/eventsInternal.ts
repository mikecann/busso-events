import { internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    // Get events that haven't been scraped in the last 24 hours
    return await ctx.db
      .query("events")
      .filter((q) => 
        q.or(
          q.eq(q.field("lastScraped"), undefined),
          q.lt(q.field("lastScraped"), oneDayAgo)
        )
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

    // Schedule subscription matching for this new event (8 hours delay)
    await scheduleSubscriptionMatching(ctx, eventId);

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
  },
  handler: async (ctx, args) => {
    const updates: any = {
      lastScraped: Date.now(),
      scrapedData: args.scrapedData,
    };

    if (args.description) {
      updates.description = args.description;
    }

    await ctx.db.patch(args.eventId, updates);

    // Schedule subscription matching for this event (8 hours delay)
    await scheduleSubscriptionMatching(ctx, args.eventId);
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

    // Schedule subscription matching for this new event (8 hours delay)
    await scheduleSubscriptionMatching(ctx, eventId);

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
    { eventId }
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
      Object.entries(updates).filter(([_, value]) => value !== undefined)
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

// Placeholder scraping action - this would contain actual scraping logic
export const performEventScrape = internalAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    scrapedData?: any;
  }> => {
    try {
      // Get the event
      const event: any = await ctx.runQuery(internal.eventsInternal.getEventById, {
        eventId: args.eventId,
      });

      if (!event) {
        return {
          success: false,
          message: "Event not found",
        };
      }

      // Simulate scraping - in real implementation, this would scrape the event URL
      const scrapedData: any = {
        location: "Sample Location",
        organizer: "Sample Organizer",
        price: "Free",
        category: "Technology",
        tags: ["tech", "networking"],
        registrationUrl: event.url,
        contactInfo: "contact@example.com",
        additionalDetails: "Additional event details from scraping",
      };

      // Update the event with scraped data
      await ctx.runMutation(internal.eventsInternal.updateEventAfterScrape, {
        eventId: args.eventId,
        scrapedData,
        description: event.description + " (Enhanced with scraped data)",
      });

      return {
        success: true,
        message: "Event scraped successfully",
        scrapedData,
      };
    } catch (error) {
      console.error("Error scraping event:", error);
      return {
        success: false,
        message: `Scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
