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

    // Get events with workpool subscription matching jobs
    const eventsWithQueuedMatching = await ctx.db
      .query("events")
      .filter((q: any) => q.neq(q.field("subscriptionMatchWorkId"), undefined))
      .collect();

    // For workpool jobs, we can't easily determine "upcoming vs overdue" without checking each status
    // So we'll just report total queued jobs and provide basic stats
    const totalQueuedMatching = eventsWithQueuedMatching.length;

    // Get a sample of events for the next matches display
    const nextMatches = eventsWithQueuedMatching
      .filter((event: Doc<"events">) => event.subscriptionMatchEnqueuedAt)
      .sort(
        (a: Doc<"events">, b: Doc<"events">) =>
          (a.subscriptionMatchEnqueuedAt || 0) -
          (b.subscriptionMatchEnqueuedAt || 0),
      )
      .slice(0, 5);

    return {
      totalScheduledMatching: totalQueuedMatching,
      upcomingMatching: totalQueuedMatching, // All queued jobs are considered "upcoming"
      overdueMatching: 0, // Workpool handles this internally
      nextMatches: nextMatches.map((event: Doc<"events">) => ({
        eventId: event._id,
        title: event.title,
        scheduledAt: event.subscriptionMatchEnqueuedAt, // This is when it was enqueued
      })),
    };
  },
});
