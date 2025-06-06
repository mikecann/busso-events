import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

// Send emails for subscriptions that are ready
export const sendScheduledEmails = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; successful: number; failed: number }> => {
    console.log("📧 Starting scheduled email sending job at:", new Date().toISOString());
    
    try {
      // Get all subscriptions that are ready for email sending
      const readySubscriptions = await ctx.runQuery(internal.subscriptionQueries.getSubscriptionsReadyForEmail);
      
      console.log("📊 Found subscriptions ready for email:", {
        count: readySubscriptions.length,
        subscriptions: readySubscriptions.map((s: any) => ({
          id: s._id,
          userId: s.userId,
          prompt: s.prompt.substring(0, 50) + "...",
          nextEmailScheduled: s.nextEmailScheduled ? new Date(s.nextEmailScheduled).toISOString() : "Not scheduled",
          isReady: s.nextEmailScheduled ? s.nextEmailScheduled <= Date.now() : false
        }))
      });

      if (readySubscriptions.length === 0) {
        console.log("✅ No subscriptions ready for email sending");
        return { processed: 0, successful: 0, failed: 0 };
      }

      let successful = 0;
      let failed = 0;

      // Process each subscription
      for (const subscription of readySubscriptions) {
        console.log(`📧 Processing subscription ${subscription._id} for user ${subscription.userId}`);
        
        try {
          const result = await ctx.runAction(internal.emailSending.sendSubscriptionEmailInternal, {
            subscriptionId: subscription._id,
          });

          if (result.success) {
            console.log(`✅ Email sent successfully for subscription ${subscription._id}:`, result);
            successful++;
          } else {
            console.error(`❌ Email failed for subscription ${subscription._id}:`, result.message);
            failed++;
          }
        } catch (error) {
          console.error(`💥 Error processing subscription ${subscription._id}:`, error);
          failed++;
        }
      }

      const summary = {
        processed: readySubscriptions.length,
        successful,
        failed
      };

      console.log("📧 Scheduled email sending job completed:", summary);
      return summary;

    } catch (error) {
      console.error("💥 Error in scheduled email sending job:", error);
      throw error;
    }
  },
});

// Clean up old email queue items (older than 30 days)
export const cleanupEmailQueue = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deletedCount: number }> => {
    console.log("🧹 Starting email queue cleanup job at:", new Date().toISOString());
    
    try {
      const deletedCount: number = await ctx.runMutation(internal.emailQueue.cleanupOldQueueItems);
      console.log(`🧹 Cleaned up ${deletedCount} old email queue items`);
      return { deletedCount };
    } catch (error) {
      console.error("💥 Error in email queue cleanup job:", error);
      throw error;
    }
  },
});

const crons = cronJobs();

// Send emails every 30 minutes
crons.interval("send scheduled emails", { minutes: 30 }, internal.crons.sendScheduledEmails, {});

// Clean up old email queue items daily at 2 AM
crons.cron("cleanup email queue", "0 2 * * *", internal.crons.cleanupEmailQueue, {});

export default crons;
