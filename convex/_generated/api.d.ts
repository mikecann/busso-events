/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as emailQueue from "../emailQueue.js";
import type * as emailSending from "../emailSending.js";
import type * as embeddingQueries from "../embeddingQueries.js";
import type * as embeddings from "../embeddings.js";
import type * as eventSources from "../eventSources.js";
import type * as events from "../events.js";
import type * as eventsAdmin from "../eventsAdmin.js";
import type * as eventsInternal from "../eventsInternal.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as router from "../router.js";
import type * as scraping from "../scraping.js";
import type * as seedEvents from "../seedEvents.js";
import type * as subscriptionMatching from "../subscriptionMatching.js";
import type * as subscriptionQueries from "../subscriptionQueries.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  emailQueue: typeof emailQueue;
  emailSending: typeof emailSending;
  embeddingQueries: typeof embeddingQueries;
  embeddings: typeof embeddings;
  eventSources: typeof eventSources;
  events: typeof events;
  eventsAdmin: typeof eventsAdmin;
  eventsInternal: typeof eventsInternal;
  http: typeof http;
  jobs: typeof jobs;
  router: typeof router;
  scraping: typeof scraping;
  seedEvents: typeof seedEvents;
  subscriptionMatching: typeof subscriptionMatching;
  subscriptionQueries: typeof subscriptionQueries;
  subscriptions: typeof subscriptions;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
