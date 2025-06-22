import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  getIsActive,
  QueuedEventItem,
  SubscriptionWithQueue,
  isPromptSubscription,
} from "./common";

export const getSubscriptionById = internalQuery({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args) => {
    console.log("🔍 Getting subscription by ID:", args.subscriptionId);
    const subscription = await ctx.db.get(args.subscriptionId);

    if (subscription) {
      console.log("✅ Subscription found:", {
        id: subscription._id,
        userId: subscription.userId,
        prompt: isPromptSubscription(subscription)
          ? subscription.prompt
          : "N/A (all events)",
        isActive: subscription.isActive,
        lastEmailSent: subscription.lastEmailSent
          ? new Date(subscription.lastEmailSent).toISOString()
          : "Never",
        nextEmailScheduled: subscription.nextEmailScheduled
          ? new Date(subscription.nextEmailScheduled).toISOString()
          : "Not scheduled",
        emailFrequencyHours: subscription.emailFrequencyHours || 24,
      });
    } else {
      console.error("❌ Subscription not found:", args.subscriptionId);
    }

    return subscription;
  },
});

export const getSubscriptionsReadyForEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    console.log(
      "🔍 Getting subscriptions ready for email at:",
      new Date().toISOString(),
    );

    const now = Date.now();
    console.log(
      "📅 Current timestamp:",
      now,
      "Date:",
      new Date(now).toISOString(),
    );

    // Get all active subscriptions
    const allSubscriptions = await ctx.db
      .query("subscriptions")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    console.log("📊 All active subscriptions:", {
      count: allSubscriptions.length,
      subscriptions: allSubscriptions.map((s) => ({
        id: s._id,
        userId: s.userId,
        prompt: isPromptSubscription(s)
          ? s.prompt.substring(0, 30) + "..."
          : "All events",
        nextEmailScheduled: s.nextEmailScheduled
          ? new Date(s.nextEmailScheduled).toISOString()
          : "Not scheduled",
        isReady: s.nextEmailScheduled ? s.nextEmailScheduled <= now : false,
      })),
    });

    // Filter for subscriptions that are ready for email
    const readySubscriptions = allSubscriptions.filter((subscription) => {
      const isReady =
        subscription.nextEmailScheduled &&
        subscription.nextEmailScheduled <= now;

      if (isReady && subscription.nextEmailScheduled) {
        console.log(`✅ Subscription ${subscription._id} is ready for email:`, {
          nextEmailScheduled: new Date(
            subscription.nextEmailScheduled,
          ).toISOString(),
          currentTime: new Date(now).toISOString(),
          timeDiff: now - subscription.nextEmailScheduled,
        });
      }

      return isReady;
    });

    console.log("📧 Subscriptions ready for email:", {
      count: readySubscriptions.length,
      readyIds: readySubscriptions.map((s) => s._id),
    });

    return readySubscriptions;
  },
});

export const getActiveSubscriptions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("subscriptions")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const listUserSubscriptions = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<SubscriptionWithQueue[]> => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    // Get queued events for each subscription
    const subscriptionsWithQueue: SubscriptionWithQueue[] = await Promise.all(
      subscriptions.map(async (sub): Promise<SubscriptionWithQueue> => {
        const queuedEvents: QueuedEventItem[] = await ctx.runQuery(
          internal.emailQueue.getQueuedEventsForSubscription,
          {
            subscriptionId: sub._id,
            includeAlreadySent: false,
          },
        );

        // Calculate next email time
        const emailFrequency = sub.emailFrequencyHours || 24; // Default 24 hours
        const lastEmailSent = sub.lastEmailSent || 0;
        const nextEmailTime = lastEmailSent + emailFrequency * 60 * 60 * 1000;

        return {
          ...sub,
          isActive: getIsActive(sub),
          queuedEvents: queuedEvents.slice(0, 5), // Show first 5 events
          totalQueuedEvents: queuedEvents.length,
          nextEmailScheduled: nextEmailTime,
          emailFrequencyHours: emailFrequency,
        };
      }),
    );

    return subscriptionsWithQueue;
  },
});

export const getUserSubscription = internalQuery({
  args: {
    userId: v.id("users"),
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<SubscriptionWithQueue | null> => {
    // First verify the subscription belongs to this user
    const subscription = await ctx.db.get(args.subscriptionId);

    if (!subscription || subscription.userId !== args.userId) {
      return null;
    }

    // Get queued events for this subscription (all of them, not just first 5)
    const queuedEvents: QueuedEventItem[] = await ctx.runQuery(
      internal.emailQueue.getQueuedEventsForSubscription,
      {
        subscriptionId: subscription._id,
        includeAlreadySent: false,
      },
    );

    // Calculate next email time
    const emailFrequency = subscription.emailFrequencyHours || 24; // Default 24 hours
    const lastEmailSent = subscription.lastEmailSent || 0;
    const nextEmailTime = lastEmailSent + emailFrequency * 60 * 60 * 1000;

    return {
      ...subscription,
      isActive: getIsActive(subscription),
      queuedEvents: queuedEvents, // Return all queued events for detail page
      totalQueuedEvents: queuedEvents.length,
      nextEmailScheduled: nextEmailTime,
      emailFrequencyHours: emailFrequency,
    };
  },
});

export const createPromptSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    prompt: v.string(),
    isActive: v.boolean(),
    emailFrequencyHours: v.number(),
  },
  handler: async (ctx, args) => {
    const subscriptionId = await ctx.db.insert("subscriptions", {
      kind: "prompt",
      userId: args.userId,
      prompt: args.prompt,
      isActive: args.isActive,
      emailFrequencyHours: args.emailFrequencyHours,
      lastEmailSent: 0, // Never sent
      nextEmailScheduled: Date.now(), // Can send immediately
    });

    // Schedule embedding generation for the new subscription
    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.generateSubscriptionEmbedding,
      {
        subscriptionId,
      },
    );

    return subscriptionId;
  },
});

export const createAllEventsSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    isActive: v.boolean(),
    emailFrequencyHours: v.number(),
  },
  handler: async (ctx, args) => {
    const subscriptionId = await ctx.db.insert("subscriptions", {
      kind: "all_events",
      userId: args.userId,
      isActive: args.isActive,
      emailFrequencyHours: args.emailFrequencyHours,
      lastEmailSent: 0, // Never sent
      nextEmailScheduled: Date.now(), // Can send immediately
    });

    return subscriptionId;
  },
});

// Keep the old function for backward compatibility (defaults to prompt subscription)
export const createSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    prompt: v.string(),
    isActive: v.boolean(),
    emailFrequencyHours: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"subscriptions">> => {
    return await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal.createPromptSubscription,
      args,
    );
  },
});

export const updateSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionId: v.id("subscriptions"),
    prompt: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    emailFrequencyHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== args.userId) {
      throw new Error(
        `Subscription of id '${args.subscriptionId}' for userId '${args.userId}' not found or access denied`,
      );
    }

    const updates: any = {};

    // Only allow prompt updates for prompt subscriptions
    if (args.prompt !== undefined) {
      if (!isPromptSubscription(subscription)) {
        throw new Error("Cannot update prompt for non-prompt subscription");
      }
      updates.prompt = args.prompt;
    }

    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
      updates.status = undefined; // Remove old field
    }
    if (args.emailFrequencyHours !== undefined)
      updates.emailFrequencyHours = args.emailFrequencyHours;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.subscriptionId, updates);
    }

    // If prompt changed, regenerate embedding (only for prompt subscriptions)
    if (args.prompt && isPromptSubscription(subscription)) {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.generateSubscriptionEmbedding,
        {
          subscriptionId: args.subscriptionId,
        },
      );
    }
  },
});

export const deleteSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== args.userId) {
      throw new Error(
        `Subscription of id '${args.subscriptionId}' for userId '${args.userId}' not found or access denied`,
      );
    }

    await ctx.db.delete(args.subscriptionId);
  },
});

export const searchEventsByTitle = internalQuery({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    return await ctx.db
      .query("events")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.searchTerm),
      )
      .take(limit);
  },
});

// Vector search for events by embedding - placeholder for now
export const searchEventsByEmbedding = internalQuery({
  args: {
    embedding: v.array(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Vector search can only be done in actions, not queries
    // This is a placeholder that returns empty results
    console.log(
      "⚠️ Vector search can only be performed in actions, not queries",
    );
    return [];
  },
});

export const updateSubscriptionEmbedding = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, {
      promptEmbedding: args.embedding,
    });
  },
});
