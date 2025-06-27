import {
  internalQuery,
  internalMutation,
  internalAction,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  getIsActive,
  QueuedEventItem,
  SubscriptionWithQueue,
  isPromptSubscription,
} from "./common";
import { components } from "../_generated/api";
import { Workpool, WorkId } from "@convex-dev/workpool";

// Initialize the workpool for subscription email sending with max parallelism of 2
const subscriptionEmailPool = new Workpool(
  components.subscriptionEmailWorkpool,
  {
    maxParallelism: 2, // Allow 2 concurrent email sending jobs
  },
);

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
    const now = Date.now();
    const subscriptionId = await ctx.db.insert("subscriptions", {
      kind: "prompt",
      userId: args.userId,
      prompt: args.prompt,
      isActive: args.isActive,
      emailFrequencyHours: args.emailFrequencyHours,
      lastEmailSent: 0, // Never sent
      nextEmailScheduled: now, // Can send immediately
    });

    // Schedule embedding generation for the new subscription
    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.generateSubscriptionEmbedding,
      {
        subscriptionId,
      },
    );

    // No email job scheduled on creation - jobs are only scheduled when events are queued

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
    const now = Date.now();
    const subscriptionId = await ctx.db.insert("subscriptions", {
      kind: "all_events",
      userId: args.userId,
      isActive: args.isActive,
      emailFrequencyHours: args.emailFrequencyHours,
      lastEmailSent: 0, // Never sent
      nextEmailScheduled: now, // Can send immediately
    });

    // No email job scheduled on creation - jobs are only scheduled when events are queued

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
    }
    if (args.emailFrequencyHours !== undefined)
      updates.emailFrequencyHours = args.emailFrequencyHours;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.subscriptionId, updates);
    }

    // Handle workpool job scheduling based on active status changes
    if (args.isActive !== undefined) {
      if (args.isActive) {
        // Subscription was activated - but don't schedule job until events are queued
        console.log(
          `✅ Subscription ${args.subscriptionId} activated - will schedule email jobs when events are queued`,
        );
      } else {
        // Subscription was deactivated - cancel any existing workpool job
        if (subscription.emailWorkId) {
          await ctx.runMutation(
            internal.subscriptions.subscriptionsInternal
              .cancelSubscriptionEmailJob,
            {
              subscriptionId: args.subscriptionId,
            },
          );
        }
      }
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

// Helper function to enqueue subscription email sending in workpool
export const enqueueSubscriptionEmail = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    delayMs: v.optional(v.number()), // Optional delay in milliseconds
  },
  handler: async (ctx, args): Promise<string> => {
    console.log(
      `📧 Enqueueing subscription email for subscription ${args.subscriptionId} in workpool`,
    );

    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription of id '${args.subscriptionId}' not found`);
    }

    // Cancel any existing workpool job for this subscription
    if (subscription.emailWorkId) {
      try {
        await subscriptionEmailPool.cancel(
          ctx,
          subscription.emailWorkId as WorkId,
        );
        console.log(
          `🗑️ Cancelled existing email workpool job: ${subscription.emailWorkId}`,
        );
      } catch (error) {
        console.log(
          "Could not cancel existing subscription email workpool job:",
          error,
        );
      }
    }

    // Calculate delay - use provided delay or schedule for nextEmailScheduled time
    const now = Date.now();
    const delayMs =
      args.delayMs ?? Math.max(0, subscription.nextEmailScheduled - now);

    // Enqueue the email sending action in the workpool
    const workId = await subscriptionEmailPool.enqueueAction(
      ctx,
      internal.subscriptions.subscriptionsInternal.performSubscriptionEmail,
      { subscriptionId: args.subscriptionId },
      { runAt: now + delayMs },
    );

    // Update the subscription with the workpool job ID and enqueue time
    await ctx.db.patch(args.subscriptionId, {
      emailWorkId: workId,
      emailEnqueuedAt: now,
    });

    console.log(
      `✅ Enqueued subscription email with workId: ${workId}, delay: ${delayMs}ms`,
    );
    return workId;
  },
});

// Workpool function to perform subscription email sending
export const performSubscriptionEmail = internalAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    message: string;
    eventsSent?: number;
  }> => {
    console.log(
      `📧 Starting workpool email sending for subscription ${args.subscriptionId}`,
    );

    try {
      // Send the email using the existing email sending logic
      const result = await ctx.runAction(
        internal.emailSending.sendSubscriptionEmailInternal,
        {
          subscriptionId: args.subscriptionId,
        },
      );

      // Clear the workpool job info since the job is now complete
      await ctx.runMutation(
        internal.subscriptions.subscriptionsInternal
          .clearSubscriptionEmailWorkpoolJob,
        {
          subscriptionId: args.subscriptionId,
        },
      );

      console.log(
        `✅ Workpool email sending completed for subscription ${args.subscriptionId}:`,
        result,
      );
      return result;
    } catch (error) {
      console.error(
        `❌ Workpool email sending failed for subscription ${args.subscriptionId}:`,
        error,
      );

      // Even if there was an error, clear the workpool job info
      try {
        await ctx.runMutation(
          internal.subscriptions.subscriptionsInternal
            .clearSubscriptionEmailWorkpoolJob,
          {
            subscriptionId: args.subscriptionId,
          },
        );
      } catch (clearError) {
        console.error(
          `❌ Failed to clear workpool job after error:`,
          clearError,
        );
      }

      return {
        success: false,
        message: `Workpool email sending failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

// NOTE: scheduleNextSubscriptionEmail removed - no longer used since we don't auto-schedule recurring emails

// Get subscription email workpool status
export const getSubscriptionEmailWorkpoolStatus = internalQuery({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription?.emailWorkId) {
      return null;
    }

    try {
      const status = await subscriptionEmailPool.status(
        ctx,
        subscription.emailWorkId as WorkId,
      );
      return {
        workId: subscription.emailWorkId,
        enqueuedAt: subscription.emailEnqueuedAt,
        status,
      };
    } catch (error) {
      console.error("Error getting subscription email workpool status:", error);
      return {
        workId: subscription.emailWorkId,
        enqueuedAt: subscription.emailEnqueuedAt,
        status: null,
        error: "Failed to get status",
      };
    }
  },
});

// Get subscriptions with email workpool jobs
export const getSubscriptionsWithEmailJobs = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("subscriptions")
      .filter((q) => q.neq(q.field("emailWorkId"), undefined))
      .collect();
  },
});

// Cancel subscription email workpool job
export const cancelSubscriptionEmailJob = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<void> => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      console.error(
        `❌ Subscription ${args.subscriptionId} not found when canceling email job`,
      );
      return;
    }

    // Cancel the workpool job if it exists
    if (subscription.emailWorkId) {
      try {
        await subscriptionEmailPool.cancel(
          ctx,
          subscription.emailWorkId as WorkId,
        );
        console.log(
          `🗑️ Cancelled email workpool job: ${subscription.emailWorkId}`,
        );
      } catch (error) {
        console.log("Could not cancel subscription email workpool job:", error);
      }
    }

    // Clear the workpool job info
    await ctx.db.patch(args.subscriptionId, {
      emailWorkId: undefined,
      emailEnqueuedAt: undefined,
    });

    console.log(
      `✅ Cleared email workpool job info for subscription ${args.subscriptionId}`,
    );
  },
});

// Clear subscription email workpool job (after completion)
export const clearSubscriptionEmailWorkpoolJob = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<void> => {
    // Simply clear the workpool job info without canceling (job already completed)
    await ctx.db.patch(args.subscriptionId, {
      emailWorkId: undefined,
      emailEnqueuedAt: undefined,
    });

    console.log(
      `✅ Cleared completed email workpool job info for subscription ${args.subscriptionId}`,
    );
  },
});

// Ensure subscription has an email workpool job scheduled if it needs one
export const ensureEmailWorkpoolJobScheduled = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<void> => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      console.error(
        `❌ Subscription ${args.subscriptionId} not found when ensuring email workpool job`,
      );
      return;
    }

    // Only schedule job for active subscriptions
    if (!subscription.isActive) {
      console.log(
        `⏭️ Subscription ${args.subscriptionId} is not active, skipping email workpool job scheduling`,
      );
      return;
    }

    // If subscription already has a workpool job scheduled, don't schedule another
    if (subscription.emailWorkId) {
      console.log(
        `✅ Subscription ${args.subscriptionId} already has email workpool job scheduled: ${subscription.emailWorkId}`,
      );
      return;
    }

    // Check if there are any unsent queued events for this subscription
    const queuedEvents = await ctx.runQuery(
      internal.emailQueue.getQueuedEventsForSubscription,
      {
        subscriptionId: args.subscriptionId,
        includeAlreadySent: false,
      },
    );

    if (queuedEvents.length === 0) {
      console.log(
        `📭 No queued events for subscription ${args.subscriptionId}, no need to schedule email workpool job`,
      );
      return;
    }

    // Schedule a 24-hour email workpool job since there are queued events
    console.log(
      `📧 Scheduling 24-hour email workpool job for subscription ${args.subscriptionId} (${queuedEvents.length} queued events)`,
    );

    // Use the subscription's email frequency for the delay (default 24 hours)
    const delayMs = subscription.emailFrequencyHours * 60 * 60 * 1000;

    await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal.enqueueSubscriptionEmail,
      {
        subscriptionId: args.subscriptionId,
        delayMs, // 24-hour delay (or whatever the subscription frequency is)
      },
    );
  },
});
