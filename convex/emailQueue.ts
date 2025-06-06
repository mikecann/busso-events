import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getQueuedEventsForSubscription = internalQuery({
  args: {
    subscriptionId: v.id("subscriptions"),
    includeAlreadySent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("emailQueue")
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId),
      );

    if (!args.includeAlreadySent) {
      query = query.filter((q) => q.neq(q.field("emailSent"), true));
    }

    const queueItems = await query.collect();

    // Get the full event data for each queue item
    const queueWithEvents = await Promise.all(
      queueItems.map(async (item) => {
        const event = await ctx.db.get(item.eventId);
        return {
          ...item,
          event,
        };
      }),
    );

    // Filter out items where event was deleted and sort by match score
    return queueWithEvents
      .filter((item) => item.event !== null)
      .sort((a, b) => b.matchScore - a.matchScore);
  },
});

export const addToQueue = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    eventId: v.id("events"),
    matchScore: v.number(),
    matchType: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if this event is already queued for this subscription
    const existing = await ctx.db
      .query("emailQueue")
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId),
      )
      .filter((q) => q.eq(q.field("eventId"), args.eventId))
      .first();

    if (existing) {
      // Update the existing entry if the new score is higher
      if (args.matchScore > existing.matchScore) {
        await ctx.db.patch(existing._id, {
          matchScore: args.matchScore,
          matchType: args.matchType,
          queuedAt: Date.now(),
        });
      }
      return existing._id;
    }

    // Add new item to queue
    return await ctx.db.insert("emailQueue", {
      subscriptionId: args.subscriptionId,
      eventId: args.eventId,
      matchScore: args.matchScore,
      matchType: args.matchType,
      queuedAt: Date.now(),
      emailSent: false,
    });
  },
});

export const markEventsAsSent = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    eventIds: v.array(v.id("events")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const eventId of args.eventIds) {
      const queueItem = await ctx.db
        .query("emailQueue")
        .withIndex("by_subscription", (q) =>
          q.eq("subscriptionId", args.subscriptionId),
        )
        .filter((q) => q.eq(q.field("eventId"), eventId))
        .first();

      if (queueItem) {
        await ctx.db.patch(queueItem._id, {
          emailSent: true,
          emailSentAt: now,
        });
      }
    }
  },
});

export const cleanupOldQueueItems = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const oldItems = await ctx.db
      .query("emailQueue")
      .withIndex("by_queued_at", (q) => q.lt("queuedAt", thirtyDaysAgo))
      .collect();

    let deletedCount = 0;
    for (const item of oldItems) {
      await ctx.db.delete(item._id);
      deletedCount++;
    }

    return deletedCount;
  },
});

export const getQueueStats = query({
  args: {},
  handler: async (ctx) => {
    const totalQueued = await ctx.db.query("emailQueue").collect();
    const unsent = totalQueued.filter((item) => !item.emailSent);
    const sent = totalQueued.filter((item) => item.emailSent);

    return {
      total: totalQueued.length,
      unsent: unsent.length,
      sent: sent.length,
    };
  },
});
