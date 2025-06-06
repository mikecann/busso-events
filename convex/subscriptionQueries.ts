import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

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
        prompt: subscription.prompt,
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
        prompt: s.prompt.substring(0, 30) + "...",
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

// Temporarily simplified version without vector search
export const searchEventsByEmbedding = internalQuery({
  args: {
    embedding: v.array(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, _args) => {
    // For now, return empty array to avoid TypeScript errors
    // This will be fixed once the vector index is properly set up
    console.log("⚠️ Vector search temporarily disabled");
    return [];
  },
});
