import { v } from "convex/values";
import { internal } from "../_generated/api";
import { adminQuery, adminAction } from "../utils";
import { Doc } from "../_generated/dataModel";

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

    const now = Date.now();
    const readyForEmail = allSubscriptions.filter(
      (sub) =>
        sub.isActive === true &&
        sub.nextEmailScheduled &&
        sub.nextEmailScheduled <= now,
    ).length;

    return {
      total: allSubscriptions.length,
      active: activeCount,
      inactive: inactiveCount,
      readyForEmail,
      avgEmailFrequency:
        allSubscriptions.reduce(
          (acc, sub) => acc + (sub.emailFrequencyHours || 24),
          0,
        ) / allSubscriptions.length || 0,
    };
  },
});
