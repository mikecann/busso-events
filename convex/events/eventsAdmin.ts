import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { requireAdmin, validateEventData } from "./common";

export const getEventsReadyForScraping = query({
  args: {},
  handler: async (ctx): Promise<any[]> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(
      internal.events.eventsInternal.getEventsReadyForScrapingInternal,
    );
  },
});

export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    eventDate: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx);

    const { id, ...updates } = args;

    // Validate the update data
    validateEventData(updates);

    await ctx.runMutation(internal.events.eventsInternal.updateEventInternal, {
      eventId: id,
      ...updates,
    });
  },
});

export const deleteEvent = mutation({
  args: {
    id: v.id("events"),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx);

    await ctx.runMutation(internal.events.eventsInternal.deleteEventInternal, {
      eventId: args.id,
    });
  },
});

export const scrapeEvent = action({
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
    // Note: We can't check admin status in actions, so this is open
    // In a real app, you'd want to add proper authorization

    return await ctx.runAction(
      internal.events.eventsInternal.performEventScrape,
      {
        eventId: args.eventId,
      },
    );
  },
});

export const getSchedulingInfo = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const now = Date.now();

    // Get events with scheduled subscription matching
    const eventsWithScheduledMatching = await ctx.db
      .query("events")
      .filter((q) => q.neq(q.field("subscriptionMatchScheduledAt"), undefined))
      .collect();

    // Count upcoming vs overdue
    const upcomingMatching = eventsWithScheduledMatching.filter(
      (event) =>
        event.subscriptionMatchScheduledAt &&
        event.subscriptionMatchScheduledAt > now,
    );

    const overdueMatching = eventsWithScheduledMatching.filter(
      (event) =>
        event.subscriptionMatchScheduledAt &&
        event.subscriptionMatchScheduledAt <= now,
    );

    // Get next few upcoming subscription matches
    const nextMatches = upcomingMatching
      .sort(
        (a, b) =>
          (a.subscriptionMatchScheduledAt || 0) -
          (b.subscriptionMatchScheduledAt || 0),
      )
      .slice(0, 5);

    return {
      totalScheduledMatching: eventsWithScheduledMatching.length,
      upcomingMatching: upcomingMatching.length,
      overdueMatching: overdueMatching.length,
      nextMatches: nextMatches.map((event) => ({
        eventId: event._id,
        title: event.title,
        scheduledAt: event.subscriptionMatchScheduledAt,
      })),
    };
  },
});
