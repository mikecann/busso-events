import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { adminAction } from "../utils";
import { EmailQueueStats, QueuedEventItem, EmailSendResult } from "./common";

// ADMIN ACTIONS - Admin authentication required

export const getQueueStats = adminAction({
  args: {},
  handler: async (ctx): Promise<EmailQueueStats> => {
    return await ctx.runQuery(internal.emails.emailsInternal.getQueueStats);
  },
});

export const cleanupOldQueueItems = adminAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ success: boolean; message: string; deletedCount: number }> => {
    const deletedCount: number = await ctx.runMutation(
      internal.emails.emailsInternal.cleanupOldQueueItems,
    );

    return {
      success: true,
      message: `Cleaned up ${deletedCount} old queue items`,
      deletedCount,
    };
  },
});

export const sendTestEmail = adminAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<EmailSendResult> => {
    console.log(
      "🧪 Admin sending test email for subscription:",
      args.subscriptionId,
    );

    const result: EmailSendResult = await ctx.runAction(
      internal.emails.emailsInternal.sendSubscriptionEmailInternal,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    console.log("🧪 Test email result:", result);
    return result;
  },
});

export const getQueuedEventsForSubscription = adminAction({
  args: {
    subscriptionId: v.id("subscriptions"),
    includeAlreadySent: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<QueuedEventItem[]> => {
    return await ctx.runQuery(
      internal.emails.emailsInternal.getQueuedEventsForSubscription,
      {
        subscriptionId: args.subscriptionId,
        includeAlreadySent: args.includeAlreadySent,
      },
    );
  },
});

export const forceSendEmail = adminAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<EmailSendResult | { success: false; message: string }> => {
    console.log(
      "🚀 Admin forcing email send for subscription:",
      args.subscriptionId,
    );

    // First, update the subscription to allow immediate sending
    const subscription = await ctx.runQuery(
      internal.subscriptions.subscriptionsInternal.getSubscriptionById,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    if (!subscription) {
      return {
        success: false,
        message: `Subscription with id '${args.subscriptionId}' not found`,
      };
    }

    // Set nextEmailScheduled to now to allow immediate sending
    await ctx.runMutation(
      internal.subscriptions.subscriptionsInternal.updateSubscription,
      {
        userId: subscription.userId,
        subscriptionId: args.subscriptionId,
        emailFrequencyHours: subscription.emailFrequencyHours,
      },
    );

    // Update the nextEmailScheduled directly
    await ctx.runMutation(
      internal.emails.emailsInternal.updateSubscriptionEmailTime,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    // Now send the email
    const result: EmailSendResult = await ctx.runAction(
      internal.emails.emailsInternal.sendSubscriptionEmailInternal,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    console.log("🚀 Force email send result:", result);
    return result;
  },
});

export const resetEmailQueue = adminAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; message: string; eventsReset: number }> => {
    console.log(
      "🔄 Admin resetting email queue for subscription:",
      args.subscriptionId,
    );

    // Get all queued events for this subscription
    const queuedEvents: QueuedEventItem[] = await ctx.runQuery(
      internal.emails.emailsInternal.getQueuedEventsForSubscription,
      {
        subscriptionId: args.subscriptionId,
        includeAlreadySent: true,
      },
    );

    // Mark all as unsent by resetting their emailSent status
    for (const item of queuedEvents) {
      await ctx.runMutation(internal.emails.emailsInternal.markEventsAsSent, {
        subscriptionId: args.subscriptionId,
        eventIds: [item.eventId],
      });
    }

    // Get the subscription to update it
    const subscription = await ctx.runQuery(
      internal.subscriptions.subscriptionsInternal.getSubscriptionById,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    if (subscription) {
      // Reset the subscription's email timing
      await ctx.runMutation(
        internal.subscriptions.subscriptionsInternal.updateSubscription,
        {
          userId: subscription.userId,
          subscriptionId: args.subscriptionId,
          emailFrequencyHours: subscription.emailFrequencyHours,
        },
      );
    }

    return {
      success: true,
      message: `Reset email queue for subscription '${args.subscriptionId}'`,
      eventsReset: queuedEvents.length,
    };
  },
});
