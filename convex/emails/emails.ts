import { query, action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { EmailQueueStats, EmailSendResult } from "./common";

// PUBLIC QUERIES - No authentication required

export const getQueueStats = query({
  args: {},
  handler: async (ctx, args): Promise<EmailQueueStats> => {
    return await ctx.runQuery(internal.emails.emailsInternal.getQueueStats);
  },
});

// PUBLIC ACTIONS - No authentication required

export const sendSubscriptionEmail = action({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<EmailSendResult> => {
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
