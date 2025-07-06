import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

// Clean up old email queue items (older than 30 days)
export const cleanupEmailQueue = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deletedCount: number }> => {
    console.log(
      "🧹 Starting email queue cleanup job at:",
      new Date().toISOString(),
    );

    try {
      const deletedCount: number = await ctx.runMutation(
        internal.emails.emailsInternal.cleanupOldQueueItems,
      );
      console.log(`🧹 Cleaned up ${deletedCount} old email queue items`);
      return { deletedCount };
    } catch (error) {
      console.error("💥 Error in email queue cleanup job:", error);
      throw error;
    }
  },
});

const crons = cronJobs();

crons.interval(
  "cleanup email queue",
  { hours: 3 },
  internal.crons.cleanupEmailQueue,
  {},
);

export default crons;
