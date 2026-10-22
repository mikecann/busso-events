import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { getFunctionName } from "convex/server";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const { chat, embedding, sendEmail, completions, returnValues } = vi.hoisted(
  () => ({
    chat: vi.fn(),
    embedding: vi.fn(),
    sendEmail: vi.fn(),
    // Workpool onComplete handlers still to fire, by job id.
    completions: new Map<
      string,
      { onComplete: any; context: any; key: string }
    >(),
    // What each onComplete job's action returned, by function name and args.
    returnValues: new Map<string, unknown>(),
  }),
);
const jobKey = (name: string, args: Record<string, unknown>) =>
  `${name}:${JSON.stringify(Object.entries(args).sort())}`;
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: chat } };
    embeddings = { create: embedding };
  },
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendEmail };
  },
}));
// convex-test can't run the workpool component, so stand it in with the plain
// scheduler. Job ids, runAt, cancel and onComplete keep the same meaning for
// our code (advance() fires onComplete once a job has finished, with the
// action's real return value, as workpool does).
vi.mock("@convex-dev/workpool", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Workpool: class {
    async enqueueAction(
      ctx: any,
      fn: any,
      args: any,
      opts?: { runAt?: number; onComplete?: any; context?: any },
    ) {
      const id = await ctx.scheduler.runAt(
        opts?.runAt ?? Date.now(),
        fn,
        args,
      );
      if (opts?.onComplete) {
        const name = getFunctionName(fn);
        await recordReturnValues(name);
        completions.set(id, {
          onComplete: opts.onComplete,
          context: opts.context,
          key: jobKey(name, args),
        });
      }
      return id;
    }
    cancel(ctx: any, id: any) {
      return ctx.scheduler.cancel(id);
    }
  },
}));
const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.test.ts",
]);
// Wrap an action's handler (once) so its return values reach onComplete.
async function recordReturnValues(name: string) {
  const [path, exportName] = name.split(":");
  const fn = ((await modules[`../convex/${path}.ts`]()) as any)[exportName];
  if (fn._recording) return;
  const handler = fn._handler;
  fn._handler = async (ctx: any, args: any) => {
    const value = await handler(ctx, args);
    returnValues.set(jobKey(name, args), value);
    return value;
  };
  fn._recording = true;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 0, 1, 10, 0, 30));
  vi.stubEnv("OPENAI_API_KEY", "test-only-openai-key");
  vi.stubEnv("JINA_API_KEY", "test-only-jina-key");
  vi.stubEnv("RESEND_API_KEY", "test-only-resend-key");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  embedding.mockResolvedValue({ data: [{ embedding: Array(1536).fill(0) }] });
  chat.mockResolvedValue({ choices: [{ message: { content: "[]" } }] });
  sendEmail.mockResolvedValue({ data: { id: "test" }, error: null });
});
afterEach(() => {
  completions.clear();
  returnValues.clear();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

type T = ReturnType<typeof convexTest>;

async function advance(t: T, ms: number) {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
  // Fire finished jobs' onComplete handlers, then run anything due now that
  // they (or the jobs) queued, until nothing more is due.
  for (let fired = true; fired; ) {
    fired = false;
    for (const [id, { onComplete, context, key }] of completions) {
      const job = await t.run((ctx) => ctx.db.system.get(id as any));
      const kind = (job as any)?.state.kind;
      if (kind === "pending" || kind === "inProgress") continue;
      completions.delete(id);
      fired = true;
      const result =
        kind === "success"
          ? { kind, returnValue: returnValues.get(key) ?? null }
          : kind === "failed"
            ? { kind, error: "failed" }
            : { kind: "canceled" };
      await t.mutation(onComplete, { workId: id, result, context });
    }
    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();
  }
}
const pendingJobs = (t: T) =>
  t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect()).filter(
      (job) => job.state.kind === "pending",
    ),
  );
const counter = (t: T, key: string) =>
  t.run(
    async (ctx) =>
      (
        await ctx.db
          .query("abuseLimits")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique()
      )?.used ?? 0,
  );

async function signedInUser(t: T) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "demo@example.invalid" }),
  );
  return { userId, user: t.withIdentity({ subject: `${userId}|session` }) };
}

// 1. Subscription embeddings

test("a spent public embedding slice blocks subscription embeddings but not background work", async () => {
  vi.stubEnv("BUSSO_EMBEDDING_DAILY_LIMIT", "9"); // public slice is 3
  const t = convexTest(schema, modules);
  const { user } = await signedInUser(t);
  for (let i = 0; i < 3; i++)
    await t.mutation(internal.abuse.reservePaid, {
      operation: "embedding",
      pool: "public",
    });

  await expect(
    user.mutation(api.subscriptions.subscriptions.createPrompt, {
      prompt: "jazz nights",
    }),
  ).rejects.toThrow("limit");
  await expect(
    user.mutation(api.subscriptions.subscriptions.create, {
      prompt: "jazz nights",
    }),
  ).rejects.toThrow("limit");
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(embedding).not.toHaveBeenCalled();
  expect(
    await t.run((ctx) => ctx.db.query("subscriptions").collect()),
  ).toHaveLength(0);

  // Background capacity is still there, it just isn't reachable from here.
  await t.action(internal.embeddings.embeddingsInternal.generateEmbedding, {
    text: "Background event",
  });
  expect(embedding).toHaveBeenCalledTimes(1);
});

test("a spent per-user embedding quota blocks subscription create and prompt updates", async () => {
  const t = convexTest(schema, modules);
  const { user } = await signedInUser(t);
  const subscriptionId = (await user.mutation(
    api.subscriptions.subscriptions.createPrompt,
    { prompt: "jazz nights" },
  )) as Id<"subscriptions">;
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(embedding).toHaveBeenCalledTimes(1);
  // Use the rest of this user's 30/hour.
  for (let i = 0; i < 29; i++)
    await user.mutation(internal.abuse.reservePaid, { operation: "embedding" });

  await expect(
    user.mutation(api.subscriptions.subscriptions.createPrompt, {
      prompt: "folk music",
    }),
  ).rejects.toThrow("limit");
  await expect(
    user.mutation(api.subscriptions.subscriptions.update, {
      id: subscriptionId,
      prompt: "folk music",
    }),
  ).rejects.toThrow("limit");
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(embedding).toHaveBeenCalledTimes(1);
  const stored = await t.run((ctx) => ctx.db.get(subscriptionId));
  expect(stored && "prompt" in stored && stored.prompt).toBe("jazz nights");

  await t.action(internal.embeddings.embeddingsInternal.generateEmbedding, {
    text: "Background event",
  });
  expect(embedding).toHaveBeenCalledTimes(2);
});

test("subscription embeddings charge the owner and public slice exactly once", async () => {
  const t = convexTest(schema, modules);
  const { userId, user } = await signedInUser(t);
  const subscriptionId = (await user.mutation(
    api.subscriptions.subscriptions.createPrompt,
    { prompt: "jazz nights" },
  )) as Id<"subscriptions">;
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(embedding).toHaveBeenCalledTimes(1);
  const stored = await t.run((ctx) => ctx.db.get(subscriptionId));
  expect(
    stored && "promptEmbedding" in stored && stored.promptEmbedding,
  ).toHaveLength(1536);

  // Same prompt: nothing to regenerate. New prompt: one more charge.
  await user.mutation(api.subscriptions.subscriptions.update, {
    id: subscriptionId,
    prompt: "jazz nights",
  });
  await user.mutation(api.subscriptions.subscriptions.update, {
    id: subscriptionId,
    prompt: "folk music",
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(embedding).toHaveBeenCalledTimes(2);
  expect(await counter(t, "embedding:global:day")).toBe(2);
  expect(await counter(t, "embedding:public:day")).toBe(2);
  expect(await counter(t, `embedding:user:${userId}:day`)).toBe(2);
});

test("the public event embedding action draws from the public slice", async () => {
  vi.stubEnv("BUSSO_EMBEDDING_DAILY_LIMIT", "3"); // public slice is 1
  const t = convexTest(schema, modules);
  const eventId = await t.run((ctx) =>
    ctx.db.insert("events", {
      title: "Demo",
      description: "Demo event",
      eventDate: Date.now(),
      imageUrl: "",
      url: "https://example.com/e/1",
    }),
  );
  const call = () =>
    t.action(api.embeddings.embeddings.generateEventEmbedding, { eventId });
  expect((await call()).success).toBe(true);
  expect((await call()).success).toBe(false);
  expect(embedding).toHaveBeenCalledTimes(1);
  expect(await counter(t, "embedding:public:day")).toBe(1);
});

// 2. Scheduled source scrapes

async function scheduledSource(t: T, name: string) {
  return await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("eventSources", {
      name,
      startingUrl: `https://example.com/${name}`,
      isActive: true,
    });
    const scheduledId = await ctx.scheduler.runAfter(
      0,
      internal.eventSources.eventSourcesInternal.performScheduledSourceScrape,
      { sourceId },
    );
    await ctx.db.patch(sourceId, {
      nextScrapeScheduledId: scheduledId,
      nextScrapeScheduledAt: Date.now(),
    });
    return sourceId;
  });
}
const source = (t: T, id: Id<"eventSources">) => t.run((ctx) => ctx.db.get(id));

test("a scheduled source scrape refused by the minute cap resumes next minute", async () => {
  const fetchMock = vi.fn(async () => new Response("# Events"));
  vi.stubGlobal("fetch", fetchMock);
  const t = convexTest(schema, modules);
  for (let i = 0; i < 6; i++)
    await t.mutation(internal.abuse.reservePaid, { operation: "scrape" });
  const sourceId = await scheduledSource(t, "minute");

  await advance(t, 0);
  expect(fetchMock).not.toHaveBeenCalled();
  const nextMinute = Date.UTC(2026, 0, 1, 10, 1, 0);
  const deferred = await source(t, sourceId);
  expect(deferred?.nextScrapeScheduledAt).toBe(nextMinute);
  const pending = await pendingJobs(t);
  expect(pending).toHaveLength(1);
  expect(pending[0]._id).toBe(deferred?.nextScrapeScheduledId);
  expect(pending[0].scheduledTime).toBe(nextMinute);

  await advance(t, 29_000); // still the full minute
  expect(fetchMock).not.toHaveBeenCalled();
  await advance(t, 1_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(chat).toHaveBeenCalledTimes(1);
  // Back on the normal 3-day cadence, with exactly one pending run.
  const resumed = await source(t, sourceId);
  expect(resumed?.dateLastScrape).toBe(nextMinute);
  expect(resumed?.nextScrapeScheduledAt).toBe(nextMinute + 3 * 24 * HOUR);
  expect(await pendingJobs(t)).toHaveLength(1);
  expect(await counter(t, "scrape:global:day")).toBe(7);
});

test("daily-capped source scrapes resume tomorrow, except inactive or removed sources", async () => {
  vi.stubEnv("BUSSO_SCRAPE_DAILY_LIMIT", "1");
  const fetchMock = vi.fn(async () => new Response("# Events"));
  vi.stubGlobal("fetch", fetchMock);
  const t = convexTest(schema, modules);
  await t.mutation(internal.abuse.reservePaid, { operation: "scrape" });
  const active = await scheduledSource(t, "active");
  const paused = await scheduledSource(t, "paused");
  const removed = await scheduledSource(t, "removed");

  await advance(t, 0);
  expect(fetchMock).not.toHaveBeenCalled();
  const tomorrow = Date.UTC(2026, 0, 2);
  for (const id of [active, paused, removed])
    expect((await source(t, id))?.nextScrapeScheduledAt).toBe(tomorrow);
  expect(await pendingJobs(t)).toHaveLength(3);

  await t.run(async (ctx) => {
    await ctx.db.patch(paused, { isActive: false });
    await ctx.db.delete(removed);
  });
  await advance(t, tomorrow - Date.now());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain("example.com/active");
  expect((await source(t, paused))?.nextScrapeScheduledId).toBeUndefined();
  const pending = await pendingJobs(t);
  expect(pending).toHaveLength(1);
  expect(pending[0]._id).toBe((await source(t, active))?.nextScrapeScheduledId);
});

// 3. Email batches

async function subscriptionWithQueue(t: T, count: number) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "demo@example.invalid" }),
  );
  const subscriptionId = await t.run((ctx) =>
    ctx.db.insert("subscriptions", {
      kind: "all_events",
      userId,
      isActive: true,
      lastEmailSent: 0,
      nextEmailScheduled: 0,
      emailFrequencyHours: 1,
    }),
  );
  for (let i = 0; i < count; i++) {
    const eventId = await t.run((ctx) =>
      ctx.db.insert("events", {
        title: `Event ${i}`,
        description: "Demo event",
        eventDate: Date.now() + 24 * HOUR,
        imageUrl: "",
        url: `https://example.com/e/${i}`,
      }),
    );
    // The real queue path, which arms the email job on the first event.
    await t.mutation(internal.emails.emailsInternal.addToQueue, {
      subscriptionId,
      eventId,
      matchScore: 0.9,
      matchType: "all_events",
    });
  }
  return { userId, subscriptionId };
}
const unsent = (t: T, subscriptionId: Id<"subscriptions">) =>
  t.run(
    async (ctx) =>
      (
        await ctx.db
          .query("emailQueue")
          .withIndex("by_subscription", (q) =>
            q.eq("subscriptionId", subscriptionId),
          )
          .collect()
      ).filter((item) => !item.emailSent).length,
  );

test("51 queued events go out as a 50 batch then a 1 batch, one frequency apart", async () => {
  vi.stubEnv("IS_PROD", "true");
  const t = convexTest(schema, modules);
  const { subscriptionId } = await subscriptionWithQueue(t, 51);
  expect(await pendingJobs(t)).toHaveLength(1);

  await advance(t, HOUR);
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(sendEmail.mock.calls[0][0].subject).toBe("50 new events for you");
  expect(await unsent(t, subscriptionId)).toBe(1);
  const pending = await pendingJobs(t);
  expect(pending).toHaveLength(1);
  const stored = await t.run((ctx) => ctx.db.get(subscriptionId));
  expect(stored?.emailWorkId).toBe(pending[0]._id);

  await advance(t, HOUR - MINUTE); // not before the subscription's frequency
  expect(sendEmail).toHaveBeenCalledTimes(1);
  await advance(t, MINUTE);
  expect(sendEmail).toHaveBeenCalledTimes(2);
  expect(sendEmail.mock.calls[1][0].subject).toBe("1 new event for you");
  expect(await unsent(t, subscriptionId)).toBe(0);
  expect(await pendingJobs(t)).toHaveLength(0);
  expect(
    (await t.run((ctx) => ctx.db.get(subscriptionId)))?.emailWorkId,
  ).toBeUndefined();
});

test("a send refused by the daily email cap is deferred to the next day, not dropped", async () => {
  vi.stubEnv("IS_PROD", "true");
  vi.stubEnv("BUSSO_EMAIL_DAILY_LIMIT", "1");
  const t = convexTest(schema, modules);
  const other = await subscriptionWithQueue(t, 0);
  await t.mutation(internal.abuse.reservePaid, {
    operation: "email",
    subscriptionId: other.subscriptionId,
  });
  const { subscriptionId } = await subscriptionWithQueue(t, 2);

  await advance(t, HOUR);
  expect(sendEmail).not.toHaveBeenCalled();
  const tomorrow = Date.UTC(2026, 0, 2);
  const pending = await pendingJobs(t);
  expect(pending).toHaveLength(1);
  expect(pending[0].scheduledTime).toBe(tomorrow);

  await advance(t, tomorrow - Date.now());
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(sendEmail.mock.calls[0][0].subject).toBe("2 new events for you");
  expect(await unsent(t, subscriptionId)).toBe(0);
  expect(await pendingJobs(t)).toHaveLength(0);
});

test("deactivating or replacing a subscription's email job stops the batch chain", async () => {
  vi.stubEnv("IS_PROD", "true");
  const t = convexTest(schema, modules);
  const { userId, subscriptionId } = await subscriptionWithQueue(t, 51);
  await advance(t, HOUR);
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(await pendingJobs(t)).toHaveLength(1);

  // The owner pauses the subscription: the remainder job is cancelled.
  await t
    .withIdentity({ subject: `${userId}|session` })
    .mutation(api.subscriptions.subscriptions.update, {
      id: subscriptionId,
      isActive: false,
    });
  expect(await pendingJobs(t)).toHaveLength(0);
  await advance(t, 2 * HOUR);
  expect(sendEmail).toHaveBeenCalledTimes(1);

  // A job that finishes after being replaced leaves the new job alone.
  await t.run((ctx) =>
    ctx.db.patch(subscriptionId, {
      isActive: true,
      emailWorkId: "newer-job",
      emailEnqueuedAt: 123,
    }),
  );
  await t.mutation(
    internal.subscriptions.subscriptionsInternal.finishSubscriptionEmailJob,
    { subscriptionId, enqueuedAt: 1, sent: true },
  );
  const stored = await t.run((ctx) => ctx.db.get(subscriptionId));
  expect(stored?.emailWorkId).toBe("newer-job");
  expect(await pendingJobs(t)).toHaveLength(0);
});

// 4. Event child jobs (page scrape and embedding per event)

const event = (t: T, id: Id<"events">) => t.run((ctx) => ctx.db.get(id));
const eventByUrl = (t: T, url: string) =>
  t.run((ctx) =>
    ctx.db
      .query("events")
      .withIndex("by_url", (q) => q.eq("url", url))
      .first(),
  );
async function newEvent(t: T, url: string) {
  return (await t.mutation(internal.events.eventsInternal.createInternal, {
    title: "New gig",
    description: "Demo event",
    eventDate: Date.now() + 24 * HOUR,
    imageUrl: "",
    url,
  })) as Id<"events">;
}

test("a source listing that takes the last scrape slot defers its new event's page scrape, which resumes once", async () => {
  const fetchMock = vi.fn(async () => new Response("# Events"));
  vi.stubGlobal("fetch", fetchMock);
  chat.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content: JSON.stringify([
            { title: "New gig", url: "https://example.com/e/new" },
          ]),
        },
      },
    ],
  });
  const t = convexTest(schema, modules);
  for (let i = 0; i < 5; i++)
    await t.mutation(internal.abuse.reservePaid, { operation: "scrape" });
  await scheduledSource(t, "listing");

  await advance(t, 0);
  // The listing used the 6th slot of the minute; the page scrape was refused.
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const created = await eventByUrl(t, "https://example.com/e/new");
  expect(created).not.toBeNull();
  const nextMinute = Date.UTC(2026, 0, 1, 10, 1, 0);
  const replacement = await t.run((ctx) =>
    ctx.db.system.get(created!.scrapeWorkId as Id<"_scheduled_functions">),
  );
  expect(replacement?.state.kind).toBe("pending");
  expect(replacement?.scheduledTime).toBe(nextMinute);
  expect(replacement?.args[0]).toEqual({
    eventId: created!._id,
    job: created!.scrapeEnqueuedAt,
  });
  // No follow-up work until the real scrape completes.
  expect(created!.embeddingWorkId).toBeUndefined();
  expect(created!.subscriptionMatchWorkId).toBeUndefined();
  // Just the source's next run and the deferred page scrape.
  expect(await pendingJobs(t)).toHaveLength(2);

  await advance(t, 29_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await advance(t, 1_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toContain("example.com/e/new");
  const scraped = await event(t, created!._id);
  expect(scraped?.lastScraped).toBe(nextMinute);
  expect(scraped?.scrapeWorkId).toBeUndefined();
  // The completed scrape hands on to embedding and matching as usual.
  expect(embedding).toHaveBeenCalledTimes(1);
  expect(scraped?.descriptionEmbedding).toHaveLength(1536);
  expect(scraped?.subscriptionMatchWorkId).toBeDefined();

  await advance(t, 10 * MINUTE);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(embedding).toHaveBeenCalledTimes(1);
  expect(await counter(t, "scrape:global:day")).toBe(7);
});

test("a background event embedding refused by the daily cap keeps its job and resumes tomorrow", async () => {
  vi.stubEnv("BUSSO_EMBEDDING_DAILY_LIMIT", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("# Gig")),
  );
  chat.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
  const t = convexTest(schema, modules);
  await t.mutation(internal.abuse.reservePaid, { operation: "embedding" });
  const eventId = await newEvent(t, "https://example.com/e/embed");

  await advance(t, 0);
  expect(embedding).not.toHaveBeenCalled();
  const tomorrow = Date.UTC(2026, 0, 2);
  const deferred = await event(t, eventId);
  expect(deferred?.lastScraped).toBeDefined();
  const replacement = await t.run((ctx) =>
    ctx.db.system.get(deferred!.embeddingWorkId as Id<"_scheduled_functions">),
  );
  expect(replacement?.state.kind).toBe("pending");
  expect(replacement?.scheduledTime).toBe(tomorrow);
  expect(replacement?.args[0]).toEqual({
    eventId,
    job: deferred!.embeddingEnqueuedAt,
  });

  await advance(t, tomorrow - Date.now() - 1);
  expect(embedding).not.toHaveBeenCalled();
  await advance(t, 1);
  expect(embedding).toHaveBeenCalledTimes(1);
  const embedded = await event(t, eventId);
  expect(embedded?.descriptionEmbedding).toHaveLength(1536);
  expect(embedded?.embeddingWorkId).toBeUndefined();
  await advance(t, HOUR);
  expect(embedding).toHaveBeenCalledTimes(1);
  expect(await counter(t, "embedding:global:day")).toBe(1);
});

test("deferred event scrapes stop for deleted, superseded or cancelled events", async () => {
  const fetchMock = vi.fn(async () => new Response("# Gig"));
  vi.stubGlobal("fetch", fetchMock);
  const t = convexTest(schema, modules);
  for (let i = 0; i < 6; i++)
    await t.mutation(internal.abuse.reservePaid, { operation: "scrape" });
  const removed = await newEvent(t, "https://example.com/e/removed");
  const superseded = await newEvent(t, "https://example.com/e/superseded");
  const cancelled = await newEvent(t, "https://example.com/e/cancelled");
  await advance(t, 0);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await pendingJobs(t)).toHaveLength(3);

  await t.run(async (ctx) => {
    // Gone without its job being cancelled.
    await ctx.db.delete(removed);
    // Another job now owns the pointer (e.g. an admin re-run).
    await ctx.db.patch(superseded, { scrapeEnqueuedAt: 1 });
  });
  await t.mutation(internal.events.eventsInternal.cancelEventScrapeJob, {
    eventId: cancelled,
  });
  expect(await pendingJobs(t)).toHaveLength(2);

  await advance(t, MINUTE);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await counter(t, "scrape:global:day")).toBe(6);
  // The superseded job leaves the newer owner's pointer alone and hands off
  // no follow-up work. The cancelled one's canceled callback queues none.
  const stillOwned = await event(t, superseded);
  expect(stillOwned?.scrapeEnqueuedAt).toBe(1);
  expect(stillOwned?.embeddingWorkId).toBeUndefined();
  expect(stillOwned?.subscriptionMatchWorkId).toBeUndefined();
  const cancelledEvent = await event(t, cancelled);
  expect(cancelledEvent?.embeddingWorkId).toBeUndefined();
  expect(cancelledEvent?.subscriptionMatchWorkId).toBeUndefined();
  const pending = await pendingJobs(t);
  expect(
    pending.filter((job) => job.name.includes("performEventScrape")),
  ).toHaveLength(0);
});

const followUps = async (t: T, id: Id<"events">) => {
  const e = await event(t, id);
  return {
    embedding: e?.embeddingWorkId,
    matching: e?.subscriptionMatchWorkId,
  };
};

test("a deferred scrape's completion queues nothing once an admin cancels its replacement", async () => {
  const fetchMock = vi.fn(async () => new Response("# Gig"));
  vi.stubGlobal("fetch", fetchMock);
  const t = convexTest(schema, modules);
  for (let i = 0; i < 6; i++)
    await t.mutation(internal.abuse.reservePaid, { operation: "scrape" });
  const eventId = await newEvent(t, "https://example.com/e/cancel-race");

  // The first job runs and defers itself; its onComplete hasn't fired yet
  // when the admin cancels the replacement and clears the pointer.
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
  expect((await event(t, eventId))?.scrapeEnqueuedAt).toBeDefined();
  await t.mutation(internal.events.eventsInternal.cancelEventScrapeJob, {
    eventId,
  });
  expect((await event(t, eventId))?.scrapeEnqueuedAt).toBeUndefined();

  // Fires the first job's success (handed off) and the replacement's
  // canceled callback.
  await advance(t, 0);
  expect(completions.size).toBe(0);
  await advance(t, 10 * MINUTE);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await followUps(t, eventId)).toEqual({
    embedding: undefined,
    matching: undefined,
  });
  expect(await pendingJobs(t)).toHaveLength(0);
  expect(embedding).not.toHaveBeenCalled();
});

test("a stale scrape action's real return value stops its completion after the pointer is cleared", async () => {
  const fetchMock = vi.fn(async () => new Response("# Gig"));
  vi.stubGlobal("fetch", fetchMock);
  const t = convexTest(schema, modules);
  const eventId = await newEvent(t, "https://example.com/e/stale");
  const job = (await event(t, eventId))!.scrapeEnqueuedAt!;
  const workId = (await event(t, eventId))!.scrapeWorkId!;
  // Admin cancel lands while the job's action is already running.
  await t.mutation(internal.events.eventsInternal.cancelEventScrapeJob, {
    eventId,
  });
  completions.clear();

  const returnValue = await t.action(
    internal.events.eventsInternal.performEventScrape,
    { eventId, job },
  );
  expect(returnValue).toMatchObject({ success: false, handedOff: true });
  await t.mutation(internal.events.eventsInternal.onScrapeComplete, {
    workId,
    result: { kind: "success", returnValue },
    context: { eventId, job },
  });
  // A canceled callback for the same job is ignored too.
  await t.mutation(internal.events.eventsInternal.onScrapeComplete, {
    workId,
    result: { kind: "canceled" },
    context: { eventId, job },
  });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await followUps(t, eventId)).toEqual({
    embedding: undefined,
    matching: undefined,
  });
  expect(await counter(t, "scrape:global:day")).toBe(0);
});

test("a scrape that fails at the provider still falls back to embedding and matching", async () => {
  const fetchMock = vi.fn(async () => new Response("down", { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  const t = convexTest(schema, modules);
  const eventId = await newEvent(t, "https://example.com/e/down");

  await advance(t, 0);
  expect(fetchMock).toHaveBeenCalled();
  const after = await event(t, eventId);
  expect(after?.scrapeEnqueuedAt).toBeUndefined();
  expect(after?.lastScraped).toBeUndefined();
  expect(after?.subscriptionMatchWorkId).toBeDefined();
  expect(embedding).toHaveBeenCalledTimes(1);
});
