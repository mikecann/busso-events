import { createRouter, defineRoute, param } from "type-route";
import { Id } from "../convex/_generated/dataModel";

// Define all routes for the application
export const { RouteProvider, useRoute, routes } = createRouter({
  // Public routes
  home: defineRoute("/"),
  eventDetail: defineRoute(
    {
      eventId: param.path.string,
    },
    (p) => `/event/${p.eventId}`,
  ),

  // Authentication routes
  login: defineRoute("/login"),

  // Authenticated routes
  dashboard: defineRoute("/dashboard"),
  subscriptions: defineRoute("/subscriptions"),
  createSubscription: defineRoute("/subscriptions/create"),
  subscriptionDetail: defineRoute(
    {
      subscriptionId: param.path.string,
    },
    (p) => `/subscriptions/${p.subscriptionId}`,
  ),

  // Admin routes
  admin: defineRoute("/admin"),
  sources: defineRoute("/admin/sources"),
  addSource: defineRoute("/admin/sources/add"),
  sourceDetail: defineRoute(
    {
      sourceId: param.path.string,
    },
    (p) => `/admin/sources/${p.sourceId}`,
  ),
  eventDebug: defineRoute(
    {
      eventId: param.path.string,
    },
    (p) => `/admin/event/${p.eventId}/debug`,
  ),
  subscriptionDebug: defineRoute("/admin/subscriptions/debug"),
  workpoolDebug: defineRoute(
    {
      workpoolType: param.path.string,
    },
    (p) => `/admin/workpools/${p.workpoolType}/debug`,
  ),
});

// Type helper for route parameters
export type RouteParams = {
  eventDetail: { eventId: string };
  sourceDetail: { sourceId: string };
  eventDebug: { eventId: string };
  workpoolDebug: { workpoolType: string };
  subscriptionDetail: { subscriptionId: string };
};

// Navigation helpers
export const navigation = {
  home: () => routes.home(),
  eventDetail: (eventId: Id<"events">) => routes.eventDetail({ eventId }),
  login: () => routes.login(),
  dashboard: () => routes.dashboard(),
  subscriptions: () => routes.subscriptions(),
  createSubscription: () => routes.createSubscription(),
  subscriptionDetail: (subscriptionId: Id<"subscriptions">) =>
    routes.subscriptionDetail({ subscriptionId }),
  admin: () => routes.admin(),
  sources: () => routes.sources(),
  addSource: () => routes.addSource(),
  sourceDetail: (sourceId: Id<"eventSources">) =>
    routes.sourceDetail({ sourceId }),
  eventDebug: (eventId: Id<"events">) => routes.eventDebug({ eventId }),
  subscriptionDebug: () => routes.subscriptionDebug(),
  workpoolDebug: (
    workpoolType:
      | "eventScrapeWorkpool"
      | "eventEmbeddingWorkpool"
      | "subscriptionMatchWorkpool",
  ) => routes.workpoolDebug({ workpoolType }),
} as const;
