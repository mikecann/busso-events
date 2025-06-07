import {
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    message: string;
    scrapedData?: any;
  }> => {
    try {
      console.log(`🔍 Starting event scrape for eventId: ${args.eventId}`);

      // Get the event
      const event: any = await ctx.runQuery(
        internal.eventsInternal.getEventById,
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
      const scrapedData: any = {
        location: eventDetails.location || undefined,
        organizer: eventDetails.organizer || undefined,
        price: eventDetails.price || undefined,
        category: eventDetails.category || undefined,
        tags: eventDetails.tags || [],
        registrationUrl: eventDetails.registrationUrl || event.url,
        contactInfo: eventDetails.contactInfo || undefined,
        additionalDetails: eventDetails.additionalDetails || undefined,
        originalEventDate: eventDetails.eventDate || undefined,
      };

      // Extract the best image URL from the scraped data
      let bestImageUrl = undefined;
      if (eventDetails.imageUrls && Array.isArray(eventDetails.imageUrls)) {
        // Filter out non-image URLs and find the best quality image
        const imageUrls = eventDetails.imageUrls.filter((url: string) => {
          // Skip URLs that are likely page URLs rather than images
          if (url.includes("/event/") || url.includes("/events/")) return false;
          // Only include URLs that look like image files
          return (
            /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) ||
            url.includes("media.")
          );
        });

        if (imageUrls.length > 0) {
          // Prefer larger images by looking for size indicators in the URL
          const sortedImages = imageUrls.sort((a: string, b: string) => {
            // Extract width from transformation parameters (e.g., tr=w-3240,h-1920)
            const getWidth = (url: string) => {
              const match = url.match(/tr=w-(\d+)/);
              return match ? parseInt(match[1]) : 0;
            };

            const aWidth = getWidth(a);
            const bWidth = getWidth(b);

            // If both have width info, prefer larger
            if (aWidth && bWidth) return bWidth - aWidth;

            // If only one has width info, prefer that one
            if (aWidth) return -1;
            if (bWidth) return 1;

            // Otherwise prefer URLs without size restrictions (likely original)
            if (a.includes("scaled") && !b.includes("scaled")) return 1;
            if (!a.includes("scaled") && b.includes("scaled")) return -1;

            return 0;
          });

          bestImageUrl = sortedImages[0];
          console.log(`🖼️ Selected image URL: ${bestImageUrl}`);
        }
      }

      // Update the event with scraped data
      await ctx.runMutation(internal.eventsInternal.updateEventAfterScrape, {
        eventId: args.eventId,
        scrapedData,
        // Enhance description if we got additional details
        description: eventDetails.description
          ? eventDetails.description
          : event.description,
        // Update image URL if we found a good one
        imageUrl: bestImageUrl,
      });

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
    }
  },
});
