import { createRouter, defineRoute, param } from "type-route";

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
