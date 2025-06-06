import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Helper function to check authentication
async function requireAuth(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be authenticated");
  }
  return userId;
}

// Helper function to get isActive status from either field
function getIsActive(subscription: any): boolean {
  if (subscription.isActive !== undefined) {
    return subscription.isActive;
  }
  // Fallback to old status field
  return subscription.status === "active";
}

export const list = query({
  args: {},
  handler: async (ctx): Promise<any[]> => {
    const userId = await requireAuth(ctx);
    
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Get queued events for each subscription
    const subscriptionsWithQueue: any[] = await Promise.all(
      subscriptions.map(async (sub): Promise<any> => {
        const queuedEvents: any[] = await ctx.runQuery(internal.emailQueue.getQueuedEventsForSubscription, {
          subscriptionId: sub._id,
          includeAlreadySent: false,
        });

        // Calculate next email time
        const emailFrequency = sub.emailFrequencyHours || 24; // Default 24 hours
        const lastEmailSent = sub.lastEmailSent || 0;
        const nextEmailTime = lastEmailSent + (emailFrequency * 60 * 60 * 1000);

        return {
          ...sub,
          isActive: getIsActive(sub),
          queuedEvents: queuedEvents.slice(0, 5), // Show first 5 events
          totalQueuedEvents: queuedEvents.length,
          nextEmailScheduled: nextEmailTime,
          emailFrequencyHours: emailFrequency,
        };
      })
    );

    return subscriptionsWithQueue;
  },
});

export const create = mutation({
  args: {
    prompt: v.string(),
    isActive: v.optional(v.boolean()),
    emailFrequencyHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId,
      prompt: args.prompt,
      isActive: args.isActive ?? true,
      emailFrequencyHours: args.emailFrequencyHours || 24,
      lastEmailSent: 0, // Never sent
      nextEmailScheduled: Date.now(), // Can send immediately
    });

    // Schedule embedding generation for the new subscription
    await ctx.scheduler.runAfter(0, internal.embeddings.generateSubscriptionEmbedding, {
      subscriptionId,
    });

    return subscriptionId;
  },
});

export const update = mutation({
  args: {
    id: v.id("subscriptions"),
    prompt: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    emailFrequencyHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    // Verify ownership
    const subscription = await ctx.db.get(args.id);
    if (!subscription || subscription.userId !== userId) {
      throw new Error("Subscription not found or access denied");
    }
    
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    // Remove old status field if updating isActive
    if (args.isActive !== undefined) {
      await ctx.db.patch(id, { 
        ...filteredUpdates,
        status: undefined, // Remove old field
      });
    } else {
      await ctx.db.patch(id, filteredUpdates);
    }

    // If prompt changed, regenerate embedding
    if (args.prompt) {
      await ctx.scheduler.runAfter(0, internal.embeddings.generateSubscriptionEmbedding, {
        subscriptionId: args.id,
      });
    }
  },
});

export const remove = mutation({
  args: {
    id: v.id("subscriptions"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    // Verify ownership
    const subscription = await ctx.db.get(args.id);
    if (!subscription || subscription.userId !== userId) {
      throw new Error("Subscription not found or access denied");
    }
    
    await ctx.db.delete(args.id);
  },
});
