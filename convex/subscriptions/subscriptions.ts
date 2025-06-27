import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  requireAuth,
  SubscriptionWithQueue,
  validateSubscriptionData,
} from "./common";

// Types for workpool status
interface WorkpoolStatus {
  state: "pending" | "running" | "finished" | "failed";
  previousAttempts?: number;
  retryCount?: number;
  queuePosition?: number;
  error?: string;
}

interface WorkpoolStatusResponse {
  workId: string;
  enqueuedAt: number | undefined;
  status: WorkpoolStatus | null;
  error?: string;
}

export const list = query({
  args: {},
  handler: async (ctx): Promise<SubscriptionWithQueue[]> => {
    const userId = await requireAuth(ctx);

    return await ctx.runQuery(
      internal.subscriptions.subscriptionsInternal.listUserSubscriptions,
      { userId },
    );
  },
});

export const get = query({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<SubscriptionWithQueue | null> => {
    const userId = await requireAuth(ctx);

    return await ctx.runQuery(
      internal.subscriptions.subscriptionsInternal.getUserSubscription,
      { userId, subscriptionId: args.subscriptionId },
    );
  },
});

export const createPrompt = mutation({
  args: {
    prompt: v.string(),
    isActive: v.optional(v.boolean()),
    emailFrequencyHours: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireAuth(ctx);

    // Validate the data
    validateSubscriptionData({
      kind: "prompt",
      prompt: args.prompt,
      emailFrequencyHours: args.emailFrequencyHours,
    });

    return await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal.createPromptSubscription,
      {
        userId,
        prompt: args.prompt,
        isActive: args.isActive ?? true,
        emailFrequencyHours: args.emailFrequencyHours || 24,
      },
    );
  },
});

export const createAllEvents = mutation({
  args: {
    isActive: v.optional(v.boolean()),
    emailFrequencyHours: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireAuth(ctx);

    // Validate the data
    validateSubscriptionData({
      kind: "all_events",
      emailFrequencyHours: args.emailFrequencyHours,
    });

    return await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal.createAllEventsSubscription,
      {
        userId,
        isActive: args.isActive ?? true,
        emailFrequencyHours: args.emailFrequencyHours || 24,
      },
    );
  },
});

// Keep the old create for backward compatibility (defaults to prompt subscription)
export const create = mutation({
  args: {
    prompt: v.string(),
    isActive: v.optional(v.boolean()),
    emailFrequencyHours: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireAuth(ctx);

    // Validate the data
    validateSubscriptionData({
      kind: "prompt",
      prompt: args.prompt,
      emailFrequencyHours: args.emailFrequencyHours,
    });

    return await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal.createPromptSubscription,
      {
        userId,
        prompt: args.prompt,
        isActive: args.isActive ?? true,
        emailFrequencyHours: args.emailFrequencyHours || 24,
      },
    );
  },
});

export const update = mutation({
  args: {
    id: v.id("subscriptions"),
    prompt: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    emailFrequencyHours: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireAuth(ctx);

    // Validate the data
    if (args.prompt !== undefined || args.emailFrequencyHours !== undefined) {
      validateSubscriptionData({
        prompt: args.prompt,
        emailFrequencyHours: args.emailFrequencyHours,
      });
    }

    await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal.updateSubscription,
      {
        userId,
        subscriptionId: args.id,
        prompt: args.prompt,
        isActive: args.isActive,
        emailFrequencyHours: args.emailFrequencyHours,
      },
    );
  },
});

export const remove = mutation({
  args: {
    id: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireAuth(ctx);

    await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal.deleteSubscription,
      {
        userId,
        subscriptionId: args.id,
      },
    );
  },
});

export const getSubscriptionEmailWorkpoolStatus = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args): Promise<WorkpoolStatusResponse | null> => {
    const userId = await requireAuth(ctx);

    // Verify subscription ownership
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      throw new Error("Subscription not found or access denied");
    }

    // Get workpool status
    return await ctx.runQuery(
      internal.subscriptions.subscriptionsInternal
        .getSubscriptionEmailWorkpoolStatus,
      {
        subscriptionId: args.subscriptionId,
      },
    );
  },
});
