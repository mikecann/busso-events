import { query, action } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "../_generated/api";
import { EmailQueueStats, EmailSendResult } from "./common";

// PUBLIC QUERIES - No authentication required

export const getQueueStats = query({
  args: {},
  handler: async (ctx, args): Promise<EmailQueueStats> => {
    return await ctx.runQuery(internal.emails.emailsInternal.getQueueStats);
  },
});

// Manual sending is for the subscription owner. Scheduled sends use the internal action.

export const sendSubscriptionEmail = action({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<EmailSendResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be authenticated");
    const subscription = await ctx.runQuery(
      internal.subscriptions.subscriptionsInternal.getSubscriptionById,
      { subscriptionId: args.subscriptionId },
    );
    if (!subscription || subscription.userId !== userId)
      throw new Error("Subscription not found");
    console.log("📧 Sending subscription email for:", args.subscriptionId);

    const result = await ctx.runAction(
      internal.emails.emailsInternal.sendSubscriptionEmailInternal,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    console.log("📧 Email send result:", {
      success: result.success,
      eventsSent: result.eventsSent,
    });
    return result;
  },
});
