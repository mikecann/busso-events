import { v } from "convex/values";
import { internal } from "../_generated/api";
import { adminQuery, adminAction } from "../utils";
import { Doc } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireAuth } from "./common";

export const getAllSubscriptions = adminQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("subscriptions").order("desc").collect();
  },
});

export const getSubscriptionsReadyForEmail = adminQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"subscriptions">[]> => {
    return await ctx.runQuery(
      internal.subscriptions.subscriptionsInternal
        .getSubscriptionsReadyForEmail,
    );
  },
});

export const testSubscriptionMatching = adminAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<Doc<"subscriptions"> | null> => {
    // For now, we'll just return the subscription details
    return await ctx.runQuery(
      internal.subscriptions.subscriptionsInternal.getSubscriptionById,
      {
        subscriptionId: args.subscriptionId,
      },
    );
  },
});

export const triggerMatchingForEvent = adminAction({
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
    await ctx.runAction(
      internal.subscriptions.subscriptionsMatching
        .processEventForSubscriptionMatching,
      {
        eventId: args.eventId,
      },
    );

    return {
      success: true,
      message: "Subscription matching triggered successfully",
    };
  },
});

export const getSubscriptionStats = adminQuery({
  args: {},
  handler: async (ctx) => {
    const allSubscriptions = await ctx.db.query("subscriptions").collect();

    const activeCount = allSubscriptions.filter(
      (sub) => sub.isActive === true,
    ).length;
    const inactiveCount = allSubscriptions.length - activeCount;

    // Count by subscription type
    const promptCount = allSubscriptions.filter(
      (sub) =>
        (sub as any).kind === "prompt" || (sub as any).prompt !== undefined,
    ).length;
    const allEventsCount = allSubscriptions.filter(
      (sub) => (sub as any).kind === "all_events",
    ).length;

    const now = Date.now();
    const readyForEmail = allSubscriptions.filter(
      (sub) =>
        sub.isActive === true &&
        sub.nextEmailScheduled &&
        sub.nextEmailScheduled <= now,
    ).length;

    // Get unique users
    const uniqueUsers = new Set(allSubscriptions.map((sub) => sub.userId)).size;

    // Get total queued events across all subscriptions
    const queuedEvents = await ctx.db.query("emailQueue").collect();
    const totalQueuedEvents = queuedEvents.filter(
      (item) => !item.emailSent,
    ).length;

    return {
      total: allSubscriptions.length,
      active: activeCount,
      inactive: inactiveCount,
      promptSubscriptions: promptCount,
      allEventsSubscriptions: allEventsCount,
      readyForEmail,
      uniqueUsers,
      totalQueuedEvents,
      avgEmailFrequency:
        allSubscriptions.reduce(
          (acc, sub) => acc + (sub.emailFrequencyHours || 24),
          0,
        ) / allSubscriptions.length || 0,
    };
  },
});

export const migrateSubscriptionsToDiscriminatedUnion = mutation({
  args: {},
  handler: async (ctx): Promise<{ migrated: number; total: number }> => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);

    if (!user?.isAdmin) {
      throw new Error("Only admins can run migrations");
    }

    // Get all subscriptions that don't have a 'kind' field
    const allSubscriptions = await ctx.db.query("subscriptions").collect();

    let migrated = 0;

    for (const subscription of allSubscriptions) {
      // Check if the subscription already has a 'kind' field
      if (!(subscription as any).kind) {
        // If it has a prompt, it's a prompt subscription
        if ((subscription as any).prompt !== undefined) {
          await ctx.db.patch(subscription._id, { kind: "prompt" });
          migrated++;
        }
      }
    }

    return {
      migrated,
      total: allSubscriptions.length,
    };
  },
});
