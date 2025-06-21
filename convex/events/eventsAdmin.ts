import { v } from "convex/values";
import { internal } from "../_generated/api";
import { validateEventData } from "./common";
import { adminQuery, adminMutation, adminAction } from "../utils";
import { Doc } from "../_generated/dataModel";

export const getEventsReadyForScraping = adminQuery({
  args: {},
  handler: async (ctx): Promise<any[]> => {
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

    // Get events with scheduled subscription matching
    const eventsWithScheduledMatching = await ctx.db
      .query("events")
      .filter((q: any) =>
        q.neq(q.field("subscriptionMatchScheduledAt"), undefined),
      )
      .collect();

    // Count upcoming vs overdue
    const upcomingMatching = eventsWithScheduledMatching.filter(
      (event: Doc<"events">) =>
        event.subscriptionMatchScheduledAt &&
        event.subscriptionMatchScheduledAt > now,
    );

    const overdueMatching = eventsWithScheduledMatching.filter(
      (event: Doc<"events">) =>
        event.subscriptionMatchScheduledAt &&
        event.subscriptionMatchScheduledAt <= now,
    );

    // Get next few upcoming subscription matches
    const nextMatches = upcomingMatching
      .sort(
        (a: Doc<"events">, b: Doc<"events">) =>
          (a.subscriptionMatchScheduledAt || 0) -
          (b.subscriptionMatchScheduledAt || 0),
      )
      .slice(0, 5);

    return {
      totalScheduledMatching: eventsWithScheduledMatching.length,
      upcomingMatching: upcomingMatching.length,
      overdueMatching: overdueMatching.length,
      nextMatches: nextMatches.map((event: Doc<"events">) => ({
        eventId: event._id,
        title: event.title,
        scheduledAt: event.subscriptionMatchScheduledAt,
      })),
    };
  },
});
