import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  requireAuth,
  SubscriptionWithQueue,
  validateSubscriptionData,
} from "./common";

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
      prompt: args.prompt,
      emailFrequencyHours: args.emailFrequencyHours,
    });

    return await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal.createSubscription,
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
