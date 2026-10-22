import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const { chat, embedding } = vi.hoisted(() => ({
  chat: vi.fn(),
  embedding: vi.fn(),
}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: chat } };
    embeddings = { create: embedding };
  },
}));
const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.test.ts",
]);

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-openai-key");
  vi.stubEnv("JINA_API_KEY", "test-only-jina-key");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test("concurrent anonymous reservations cannot exceed the shared daily ceiling", async () => {
  vi.stubEnv("BUSSO_EMBEDDING_DAILY_LIMIT", "2");
  const t = convexTest(schema, modules);
  const outcomes = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      t.mutation(internal.abuse.reservePaid, { operation: "embedding" }),
    ),
  );
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(2);
  const rows = await t.run((ctx) => ctx.db.query("abuseLimits").collect());
  expect(rows.find((r) => r.key === "embedding:global:day")?.used).toBe(2);
  expect(rows).toHaveLength(2);
});

test("per-user quotas use the authenticated server identity and denial rolls back global counters", async () => {
  const t = convexTest(schema, modules);
  const caller = t.withIdentity({ subject: "server-user|session" });
  for (let i = 0; i < 30; i++)
    await caller.mutation(internal.abuse.reservePaid, {
      operation: "embedding",
    });
  await expect(
    caller.mutation(internal.abuse.reservePaid, { operation: "embedding" }),
  ).rejects.toThrow("limit");
  const rows = await t.run((ctx) => ctx.db.query("abuseLimits").collect());
  expect(rows.find((r) => r.key === "embedding:global:day")?.used).toBe(30);
  await t
    .withIdentity({ subject: "another-user|session" })
    .mutation(internal.abuse.reservePaid, { operation: "embedding" });
});

test("normal scrapes work, with budget reserved before Jina and bounded OpenAI output", async () => {
  vi.stubEnv("BUSSO_SCRAPE_DAILY_LIMIT", "1");
  const fetchMock = vi.fn(async () => new Response("# Community events"));
  vi.stubGlobal("fetch", fetchMock);
  chat.mockResolvedValue({ choices: [{ message: { content: "[]" } }] });
  const t = convexTest(schema, modules);
  const args = { url: "https://example.com/events" };
  const result = await t.action(
    internal.scraping.scrapingInternal.scrapeUrlInternal,
    args,
  );
  expect(result.success).toBe(true);
  expect(chat.mock.calls[0][0].max_tokens).toBe(4096);
  await expect(
    t.action(internal.scraping.scrapingInternal.scrapeUrlInternal, args),
  ).rejects.toThrow("limit");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(chat).toHaveBeenCalledTimes(1);
});

test("embeddings stop before the provider when the shared budget is exhausted", async () => {
  vi.stubEnv("BUSSO_EMBEDDING_DAILY_LIMIT", "1");
  embedding.mockResolvedValue({ data: [{ embedding: Array(1536).fill(0) }] });
  const t = convexTest(schema, modules);
  await t.action(internal.embeddings.embeddingsInternal.generateEmbedding, {
    text: "Community events",
  });
  await expect(
    t.action(internal.embeddings.embeddingsInternal.generateEmbedding, {
      text: "Different events",
    }),
  ).rejects.toThrow("limit");
  await expect(
    t.action(internal.embeddings.embeddingsInternal.generateEmbedding, {
      text: "x".repeat(8001),
    }),
  ).rejects.toThrow("too long");
  expect(embedding).toHaveBeenCalledTimes(1);
});

test("anonymous source triggers have a source cooldown and reject inactive sources", async () => {
  const t = convexTest(schema, modules);
  const activeId = await t.run((ctx) =>
    ctx.db.insert("eventSources", {
      name: "Demo",
      startingUrl: "https://example.com/events",
      isActive: true,
    }),
  );
  const inactiveId = await t.run((ctx) =>
    ctx.db.insert("eventSources", {
      name: "Inactive",
      startingUrl: "https://example.com/events",
      isActive: false,
    }),
  );
  await t.mutation(internal.abuse.reserveSourceTrigger, { sourceId: activeId });
  await expect(
    t.mutation(internal.abuse.reserveSourceTrigger, { sourceId: activeId }),
  ).rejects.toThrow("limit");
  await expect(
    t.mutation(internal.abuse.reserveSourceTrigger, { sourceId: inactiveId }),
  ).rejects.toThrow("active");
});

test("manual email sending requires ownership and scheduled sends share subscription limits", async () => {
  const t = convexTest(schema, modules);
  const { userId, subscriptionId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "demo@example.invalid",
    });
    const subscriptionId = await ctx.db.insert("subscriptions", {
      kind: "all_events",
      userId,
      isActive: true,
      lastEmailSent: 0,
      nextEmailScheduled: 0,
      emailFrequencyHours: 24,
    });
    return { userId, subscriptionId };
  });
  await expect(
    t.action(api.emails.emails.sendSubscriptionEmail, { subscriptionId }),
  ).rejects.toThrow("authenticated");
  await expect(
    t
      .withIdentity({ subject: "another-user|session" })
      .action(api.emails.emails.sendSubscriptionEmail, { subscriptionId }),
  ).rejects.toThrow("not found");
  await t.mutation(internal.abuse.reservePaid, {
    operation: "email",
    subscriptionId,
  });
  await expect(
    t.mutation(internal.abuse.reservePaid, {
      operation: "email",
      subscriptionId,
    }),
  ).rejects.toThrow("limit");
  const rows = await t.run((ctx) => ctx.db.query("abuseLimits").collect());
  expect(rows.find((r) => r.key === `email:user:${userId}:day`)?.used).toBe(1);
});

test("public embeddings get a smaller slice of the shared global cap", async () => {
  vi.stubEnv("BUSSO_EMBEDDING_DAILY_LIMIT", "9");
  const t = convexTest(schema, modules);
  const publicCall = (subject?: string) =>
    (subject ? t.withIdentity({ subject }) : t).mutation(
      internal.abuse.reservePaid,
      { operation: "embedding", pool: "public" },
    );
  // Anonymous callers and fresh identities all draw from the same public slice.
  await publicCall();
  await publicCall("fresh-user-1|session");
  await publicCall("fresh-user-2|session");
  await expect(publicCall()).rejects.toThrow("limit");
  await expect(publicCall("fresh-user-3|session")).rejects.toThrow("limit");
  // Background work still has the rest of the global cap.
  for (let i = 0; i < 6; i++)
    await t.mutation(internal.abuse.reservePaid, { operation: "embedding" });
  // ...but the global cap is still shared, not a separate unbounded bucket.
  await expect(
    t.mutation(internal.abuse.reservePaid, { operation: "embedding" }),
  ).rejects.toThrow("limit");
  const rows = await t.run((ctx) => ctx.db.query("abuseLimits").collect());
  expect(rows.find((r) => r.key === "embedding:global:day")?.used).toBe(9);
  expect(rows.find((r) => r.key === "embedding:public:day")?.used).toBe(3);
});

test("anonymous search exhausting its slice keeps text results and background embeddings", async () => {
  vi.stubEnv("BUSSO_EMBEDDING_DAILY_LIMIT", "6");
  embedding.mockResolvedValue({ data: [{ embedding: Array(1536).fill(0) }] });
  const t = convexTest(schema, modules);
  for (let i = 0; i < 4; i++)
    await t.action(api.events.events.enhancedSearch, {
      searchTerm: `community events ${i}`,
    });
  // Public slice is 2 of 6, so only two searches reached the provider.
  expect(embedding).toHaveBeenCalledTimes(2);
  for (let i = 0; i < 4; i++)
    await t.action(internal.embeddings.embeddingsInternal.generateEmbedding, {
      text: `Background event ${i}`,
    });
  expect(embedding).toHaveBeenCalledTimes(6);
});

test("public scrapes cannot use up the background scrape budget", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.stubEnv("BUSSO_SCRAPE_DAILY_LIMIT", "60");
    const t = convexTest(schema, modules);
    let accepted = 0;
    // Many new identities, spread across minutes so only the daily slice binds.
    for (let i = 0; i < 30; i++) {
      vi.setSystemTime(Date.UTC(2026, 0, 1, 1, i));
      const outcome = await t
        .withIdentity({ subject: `fresh-user-${i}|session` })
        .mutation(internal.abuse.reservePaid, {
          operation: "scrape",
          pool: "public",
        })
        .then(
          () => true,
          () => false,
        );
      if (outcome) accepted++;
    }
    expect(accepted).toBe(20);
    // A full source fanout (1 listing + 30 event pages) still fits afterwards.
    for (let i = 0; i < 31; i++) {
      vi.setSystemTime(Date.UTC(2026, 0, 1, 2, i));
      await t.mutation(internal.abuse.reservePaid, { operation: "scrape" });
    }
  } finally {
    vi.useRealTimers();
  }
});

test("public share overrides never reach the global cap", async () => {
  const { publicShare } = await import("../convex/abuse");
  expect(publicShare("embedding", { burst: 60, daily: 500 })).toEqual({
    burst: 20,
    daily: 166,
  });
  vi.stubEnv("BUSSO_PUBLIC_EMBEDDING_DAILY_LIMIT", "100000");
  expect(publicShare("embedding", { burst: 60, daily: 500 }).daily).toBe(250);
  vi.stubEnv("BUSSO_PUBLIC_SCRAPE_DAILY_LIMIT", "0");
  expect(publicShare("scrape", { burst: 6, daily: 60 }).daily).toBe(0);
});

test("source scrape triggers require an admin", async () => {
  const t = convexTest(schema, modules);
  const { sourceId, memberId, adminId } = await t.run(async (ctx) => ({
    sourceId: await ctx.db.insert("eventSources", {
      name: "Demo",
      startingUrl: "https://example.com/events",
      isActive: true,
    }),
    memberId: await ctx.db.insert("users", { email: "m@example.invalid" }),
    adminId: await ctx.db.insert("users", {
      email: "a@example.invalid",
      isAdmin: true,
    }),
  }));
  await expect(
    t.action(api.eventSources.eventSources.triggerSourceScrape, { sourceId }),
  ).rejects.toThrow("authenticated");
  await expect(
    t
      .withIdentity({ subject: `${memberId}|session` })
      .action(api.eventSources.eventSources.triggerSourceScrape, { sourceId }),
  ).rejects.toThrow("Admin");
  const admin = t.withIdentity({ subject: `${adminId}|session` });
  // The admin call reaches the provider path; stop it at fetch.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("down", { status: 500 })),
  );
  await admin.action(api.eventSources.eventSources.triggerSourceScrape, {
    sourceId,
  });
  await expect(
    admin.action(api.eventSources.eventSources.triggerSourceScrape, {
      sourceId,
    }),
  ).rejects.toThrow("limit");
});
