import {
  customQuery,
  customMutation,
  customAction,
  customCtx,
} from "convex-helpers/server/customFunctions";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { query, mutation, action } from "./_generated/server";

// Admin authentication helper
async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be authenticated");
  }

  const isAdmin = await ctx.runQuery(
    internal.events.eventsInternal.checkUserIsAdmin,
    {
      userId,
    },
  );

  if (!isAdmin) {
    throw new Error("Admin access required");
  }

  return userId;
}

// Custom query that requires admin authentication
export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    await requireAdmin(ctx);
    // Return empty object since we're not modifying ctx
    return {};
  }),
);

// Custom mutation that requires admin authentication
export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    await requireAdmin(ctx);
    // Return empty object since we're not modifying ctx
    return {};
  }),
);

// Custom action that requires admin authentication
export const adminAction = customAction(
  action,
  customCtx(async (ctx) => {
    // For actions, we need to check admin status
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated");
    }

    const isAdmin = await ctx.runQuery(
      internal.events.eventsInternal.checkUserIsAdmin,
      {
        userId,
      },
    );

    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    // Return empty object since we're not modifying ctx
    return {};
  }),
);

// Development mode detection helper
export const isDevelopmentMode = (): boolean => {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.CONVEX_ENVIRONMENT === "development" ||
    !process.env.EMAIL_FROM_ADDRESS // Fallback to dev mode if no custom domain set
  );
};
