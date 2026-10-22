import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type Limit = { key: string; windowMs: number; maximum: number };

// Invalid configuration keeps the conservative default. Zero is an explicit stop.
export function dailyLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 100_000 ? value : fallback;
}

/**
 * Call only inside a mutation, before scheduling or starting paid work.
 * Convex retries conflicting transactions, including concurrent inserts for a key.
 * Read every bucket before writing so a refusal never partially consumes quotas.
 * Keep one reusable row per scope, rather than adding a row for every request/day.
 * Returns null once reserved, or when every full bucket resets if refused.
 */
export async function tryReserveLimits(
  ctx: Pick<MutationCtx, "db">,
  limits: Limit[],
  now = Date.now(),
): Promise<number | null> {
  const buckets = await Promise.all(
    limits.map(async (limit) => {
      const row = await ctx.db
        .query("abuseLimits")
        .withIndex("by_key", (q) => q.eq("key", limit.key))
        .unique();
      const windowStart = Math.floor(now / limit.windowMs) * limit.windowMs;
      const used = row?.windowStart === windowStart ? row.used : 0;
      return {
        row,
        full: used >= limit.maximum,
        resetsAt: windowStart + limit.windowMs,
        bucket: { key: limit.key, windowStart, used: used + 1 },
      };
    }),
  );
  const full = buckets.filter((b) => b.full);
  if (full.length > 0) return Math.max(...full.map((b) => b.resetsAt));
  for (const { row, bucket } of buckets) {
    if (row) await ctx.db.patch(row._id, bucket);
    else await ctx.db.insert("abuseLimits", bucket);
  }
  return null;
}

export async function reserveLimits(
  ctx: Pick<MutationCtx, "db">,
  limits: Limit[],
  now = Date.now(),
): Promise<void> {
  if ((await tryReserveLimits(ctx, limits, now)) !== null) {
    throw new Error("Demo request limit reached. Please try again later.");
  }
}

// Public traffic gets at most a third of each global cap by default. An override
// can change it but never past half, so background work always keeps the rest.
export function publicShare(
  operation: "scrape" | "embedding",
  policy: { burst: number; daily: number },
): { burst: number; daily: number } {
  const name = {
    scrape: "BUSSO_PUBLIC_SCRAPE_DAILY_LIMIT",
    embedding: "BUSSO_PUBLIC_EMBEDDING_DAILY_LIMIT",
  }[operation];
  return {
    burst: Math.floor(policy.burst / 3),
    daily: Math.min(
      dailyLimit(name, Math.floor(policy.daily / 3)),
      Math.floor(policy.daily / 2),
    ),
  };
}

const paidArgs = {
  operation: v.union(
    v.literal("scrape"),
    v.literal("embedding"),
    v.literal("email"),
  ),
  subscriptionId: v.optional(v.id("subscriptions")),
  // Callers reachable from public functions pass "public". Background jobs omit it.
  pool: v.optional(v.literal("public")),
};

/**
 * Every bucket one paid call draws from. Email always charges the stored
 * subscription owner. Pass userId for work done on a user's behalf whose
 * provider call runs later without their identity (e.g. scheduled jobs).
 */
export async function paidLimits(
  ctx: Pick<MutationCtx, "db">,
  {
    operation,
    subscriptionId,
    pool,
    userId,
  }: {
    operation: "scrape" | "embedding" | "email";
    subscriptionId?: Id<"subscriptions">;
    pool?: "public";
    userId?: Id<"users"> | null;
  },
): Promise<Limit[]> {
  const limits: Limit[] = [];
  if (operation === "email") {
    const subscription = subscriptionId
      ? await ctx.db.get(subscriptionId)
      : null;
    if (!subscription?.isActive) throw new Error("Subscription is not active");
    userId = subscription.userId;
    limits.push({
      key: `email:subscription:${subscriptionId}`,
      windowMs: 15 * MINUTE,
      maximum: 1,
    });
  }
  const policy = {
    scrape: {
      burst: 6,
      daily: dailyLimit("BUSSO_SCRAPE_DAILY_LIMIT", 60),
      hourlyUser: 6,
      dailyUser: 20,
    },
    embedding: {
      burst: 60,
      daily: dailyLimit("BUSSO_EMBEDDING_DAILY_LIMIT", 500),
      hourlyUser: 30,
      dailyUser: 100,
    },
    email: {
      burst: 10,
      daily: dailyLimit("BUSSO_EMAIL_DAILY_LIMIT", 100),
      hourlyUser: 10,
      dailyUser: 20,
    },
  }[operation];
  limits.push(
    {
      key: `${operation}:global:minute`,
      windowMs: MINUTE,
      maximum: policy.burst,
    },
    { key: `${operation}:global:day`, windowMs: DAY, maximum: policy.daily },
  );
  if (pool === "public") {
    if (operation === "email") throw new Error("Email has no public pool");
    // A strictly smaller slice of the same global caps, so public callers
    // (any identity, any source) can never use up the background share.
    const share = publicShare(operation, policy);
    limits.push(
      {
        key: `${operation}:public:minute`,
        windowMs: MINUTE,
        maximum: share.burst,
      },
      { key: `${operation}:public:day`, windowMs: DAY, maximum: share.daily },
    );
  }
  if (userId)
    limits.push(
      {
        key: `${operation}:user:${userId}:hour`,
        windowMs: HOUR,
        maximum: policy.hourlyUser,
      },
      {
        key: `${operation}:user:${userId}:day`,
        windowMs: DAY,
        maximum: policy.dailyUser,
      },
    );
  return limits;
}

// All provider entry points use this mutation, including jobs and scheduled work.
export const reservePaid = internalMutation({
  args: paidArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await reserveLimits(ctx, await paidLimits(ctx, { ...args, userId }));
    return null;
  },
});

// For scheduled work that defers instead of failing: null when reserved,
// otherwise the earliest time the refused buckets reset.
export const tryReservePaid = internalMutation({
  args: paidArgs,
  returns: v.union(v.null(), v.number()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    return await tryReserveLimits(
      ctx,
      await paidLimits(ctx, { ...args, userId }),
    );
  },
});

export const reserveSourceTrigger = internalMutation({
  args: { sourceId: v.id("eventSources") },
  returns: v.null(),
  handler: async (ctx, { sourceId }) => {
    const source = await ctx.db.get(sourceId);
    if (!source?.isActive) throw new Error("Source is not active");
    await reserveLimits(ctx, [
      { key: `source:${sourceId}`, windowMs: 15 * MINUTE, maximum: 1 },
    ]);
    return null;
  },
});
