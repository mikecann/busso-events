# Paid API abuse controls

## Limits

- `BUSSO_SCRAPE_DAILY_LIMIT`: **60** Jina/OpenAI scrape pairs globally per UTC day, with 6/minute globally. Authenticated callers also get 6/hour and 20/day.
- `BUSSO_EMBEDDING_DAILY_LIMIT`: **500** embedding requests globally per day, with 60/minute globally. Authenticated callers also get 30/hour and 100/day.
- `BUSSO_EMAIL_DAILY_LIMIT`: **100** emails globally per day, with 10/minute globally. The subscription owner is derived from the stored subscription and gets 10/hour and 20/day. Each subscription gets one send per 15 minutes, including scheduled sends.
- Public callers get a strictly smaller slice of those same global caps. Public embeddings (anonymous `enhancedSearch`, `previewMatchingEvents`, `findMatchingEventsForSubscription`) get 166/day and 20/minute by default. Signed-in `scrapeUrl`/`scrapeEventPage` get 20/day and 2/minute. Both also count against the global caps, so background event embeddings, subscription matching and source fanout always keep at least 334 embeddings and 40 scrapes a day (enough for a 1 listing + 30 event page fanout).
- `BUSSO_PUBLIC_EMBEDDING_DAILY_LIMIT` and `BUSSO_PUBLIC_SCRAPE_DAILY_LIMIT` override the daily public slice, but never past half the global daily cap. `0` turns semantic public calls off (search falls back to text).
- `triggerSourceScrape` is admin-only now. No UI calls it and each trigger fans out to up to 31 scrapes. It keeps its one-trigger-per-source-per-15-minute cooldown.

## Scheduled work

- **Subscription embeddings.** Creating a prompt subscription, or changing its prompt, reserves one public-slice embedding against the signed-in owner (their hourly/daily embedding quota plus the public and global caps), in the same mutation that schedules the embedding job. If the quota is spent, the create/update is refused and rolled back, so nothing is scheduled. The job is marked as already paid, so it doesn't charge again, and it can't fall back to the background share. Re-saving the same prompt doesn't regenerate it. The public `generateEventEmbedding` debug action also uses the public slice now.
- **Scheduled source scrapes.** `performScheduledSourceScrape` reserves the listing scrape first. If the budget is spent, it schedules a replacement run for when the full buckets reset (the next minute, or midnight UTC for a daily cap) and moves the source's `nextScrapeScheduledId` to it in the same transaction. So each refusal produces exactly one later retry, never an immediate loop. Inactive or deleted sources aren't restarted, and if the pointer is already a different pending run (an admin reschedule), no second chain is created. `scheduleNextScrape` now only cancels the pointer when it's still pending, rather than cancelling the run that is calling it.
- **Event page scrapes and event embeddings.** Each new event's page scrape and embedding job carries a token, stored in the event's `scrapeEnqueuedAt`/`embeddingEnqueuedAt` when it's queued. The job reserves its provider call in a mutation that first checks the event still exists and the token still matches. If the budget is spent (say the source listing took the last scrape slot of the minute), that same mutation queues one replacement job for when the full buckets reset and moves the event's pointer to it, returning `retryAt` instead of failing. So the work is put off, not lost, even though later source runs skip events that already exist. The deferred job doesn't start the embedding or matching follow-ups: those run once, after the replacement completes. A job whose event was deleted, cancelled by an admin, or taken over by a newer job stops without charging, and only clears the pointer if it still owns it. The call is reserved once in that mutation and then passed `reserved`, so there's no double charge. Admin scrapes (`scrapeEvent`, `startScrapeNow`) and the batch scrape job call it without a token: they're charged at call time, report a refusal as a failed result, and no longer clear the pointer of a job they don't own.
- **Email batches.** A send covers at most 50 queue items. When a scheduled send finishes and unsent items remain, the next batch is queued for the subscription's next allowed send (`nextEmailScheduled`, i.e. its frequency). A send refused by an email quota is deferred to whichever is later: that time, or when the quota resets. The reservation still happens at send time, so batches never overrun the global, per-user or 15-minute subscription caps. Sent items stay marked sent, so later batches don't repeat them. A job only clears and re-arms the subscription if it is still the current job (matched by `emailEnqueuedAt`), so pausing a subscription or replacing its job ends the old chain. Manual sends that leave a remainder re-arm the usual job.

Scrape and embedding reservations live at the provider entry points, so jobs, admin tools and alternate public routes share the ceiling. Functions reachable from public callers pass `pool: "public"` to the internal provider action; background jobs and admin tools omit it. A new public route that calls a provider must pass it too. Manual `sendSubscriptionEmail` calls require the subscription owner; cron/workpool sends keep their internal path. Search and preview retain their text fallback if semantic quota is exhausted.

Scrape URLs are at most 2048 characters, downloaded content is at most 1 MiB, existing model input sanitization remains capped at 100000 characters, and each extraction has at most 4096 output tokens and 30 source events. Embeddings retain the existing 8000-character cap. Anonymous search/preview input is limited to 1000 characters. Email batches contain at most 50 queue items, with bounded subjects/descriptions. OpenAI automatic retries are disabled and timeouts set.

## Reservation behavior and schema

The additive `abuseLimits` table has `key: string`, `windowStart: number`, and `used: number`, indexed by `by_key`. Each scope reuses its counter row. No existing business records, API keys, or data need migration or deletion.

All applicable counters are checked and incremented in one mutation before paid work or its scheduler entry. Conflicting requests rely on [Convex atomic transactions and OCC](https://docs.convex.dev/database/advanced/occ). Failed provider attempts still consume reservations; there are no refunds that could permit retry abuse. Daily windows reset at midnight UTC, with fixed minute/hour windows where listed. These limits count requests, rather than estimating a dollar balance.

The new environment variables are optional numeric daily ceilings. Unset, empty, negative, fractional, or malformed values use the documented default; integers above 100000 also use the default. An explicit `0` stops that operation. There is no bypass flag. Per-user limits use the authenticated server identity. Anonymous demos keep working inside the public slice.

## Review and setup

Deploy the additive schema and functions together through the normal project workflow, then smoke-test the normal flow. The tests mock paid providers and never mint, send mail or generate paid content. Existing provider credentials remain required and unchanged. Defaults apply without adding any environment variables.


## Validation

Run `./node_modules/.bin/vitest run --config tests/vitest.config.ts --silent` for all 36 tests (11 security tests, 12 scheduled-work tests and 13 existing scrape regressions). This config does not load .env files. The new tests use convex-test transactions and mocked provider calls, including simultaneous reservations. `tests/scheduled-work.test.ts` drives the real create/update mutations, scheduled source runs, event page scrape and embedding jobs, and the email job chain with fake timers. The workpool component can't run in convex-test, so that file stands it in with the plain scheduler (same runAt/cancel meaning) and fires `onComplete` once each job finishes.

Run `./node_modules/.bin/tsc -p convex --noEmit --pretty false` for backend types. Run `./node_modules/.bin/tsc -p tsconfig.app.json --noEmit --pretty false` for app types.

Expected test count after this change: 36.

## Known limitations

- A scheduled source scrape that fails for a non-quota reason (Jina/OpenAI down) still keeps its old pointer and needs an admin reschedule, as before this change.
- An email send that fails for a non-quota reason (Resend error, user without an email) still isn't retried until the next matched event re-arms the job, as before. Reservations aren't refunded.
- An event page scrape or embedding that fails for a non-quota reason still isn't retried, as before (a failed scrape still falls through to the embedding fallback).
- Event jobs already queued before this deploy have no token. Their embedding jobs run as before; their scrape jobs are charged at call time as before but leave their pointer set when done, which only shows up in the admin workpool view.
- The internal `reserved` flags on `generateEmbedding`, `generateEventDescriptionEmbedding`, `generateSubscriptionEmbedding`, `scrapeUrlInternal`, `scrapeEventPageInternal` and `performSourceScrape` skip the charge. Only callers that reserved in a mutation first set them. Internal functions can't be called from clients.
- A subscription embedding refused by quota turns into a refused create/update, with the "Demo request limit reached" error shown to the user.

## Files changed

- `SECURITY_LIMITS.md`
- `convex/_generated/api.d.ts`
- `convex/abuse.ts`
- `convex/emails/common.ts`
- `convex/emails/emails.ts`
- `convex/emails/emailsInternal.ts`
- `convex/embeddings/embeddings.ts`
- `convex/embeddings/embeddingsInternal.ts`
- `convex/eventSources/eventSources.ts`
- `convex/eventSources/eventSourcesInternal.ts`
- `convex/events/common.ts`
- `convex/events/events.ts`
- `convex/events/eventsInternal.ts`
- `convex/schema.ts`
- `convex/scraping/scraping.test.ts`
- `convex/scraping/scraping.ts`
- `convex/scraping/scrapingInternal.ts`
- `convex/subscriptions/subscriptionsInternal.ts`
- `convex/subscriptions/subscriptionsMatching.ts`
- `tests/scheduled-work.test.ts`
- `tests/security.test.ts`
- `tests/vitest.config.ts`
