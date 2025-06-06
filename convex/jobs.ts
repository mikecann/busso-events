import { query, action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Helper function to check if user is admin
async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be authenticated");
  }
  const user = await ctx.db.get(userId);
  if (!user || !user.isAdmin) {
    throw new Error("Admin access required");
  }
  return user;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    return await ctx.db
      .query("jobs")
      .withIndex("by_status")
      .order("desc")
      .collect();
  },
});

export const createBatchEventScrapeJob = action({
  args: {},
  handler: async (ctx): Promise<{ jobId: Id<"jobs">; totalEvents: number }> => {
    await requireAdmin(ctx);

    // Get events ready for scraping
    const events: any[] = await ctx.runQuery(internal.eventsInternal.getEventsReadyForScrapingInternal);
    
    if (events.length === 0) {
      throw new Error("No events are ready for scraping");
    }

    // Create the job
    const jobId: Id<"jobs"> = await ctx.runMutation(internal.jobs.createBatchEventScrapeJobInternal, {
      totalEvents: events.length,
    });

    // Start processing the job
    await ctx.runAction(internal.jobs.processBatchEventScrapeJob, {
      jobId,
      eventIds: events.map((e: any) => e._id),
    });

    return { jobId, totalEvents: events.length };
  },
});

export const createBatchSourceScrapeJob = action({
  args: {},
  handler: async (ctx): Promise<{ jobId: Id<"jobs">; totalSources: number }> => {
    await requireAdmin(ctx);

    // Get active event sources
    const sources: any[] = await ctx.runQuery(internal.eventSources.getActiveSources);
    
    if (sources.length === 0) {
      throw new Error("No active event sources found");
    }

    // Create the job
    const jobId: Id<"jobs"> = await ctx.runMutation(internal.jobs.createBatchSourceScrapeJobInternal, {
      totalSources: sources.length,
    });

    // Start processing the job
    await ctx.runAction(internal.jobs.processBatchSourceScrapeJob, {
      jobId,
      sourceIds: sources.map((s: any) => s._id),
    });

    return { jobId, totalSources: sources.length };
  },
});

// Internal mutations
export const createBatchEventScrapeJobInternal = internalMutation({
  args: {
    totalEvents: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobs", {
      kind: "batch_event_scrape",
      status: "pending",
      progress: {
        totalEvents: args.totalEvents,
        processedEvents: 0,
        successfulScrapes: 0,
        failedScrapes: 0,
        currentEvent: null,
      },
      startedAt: Date.now(),
    });
  },
});

export const createBatchSourceScrapeJobInternal = internalMutation({
  args: {
    totalSources: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobs", {
      kind: "batch_source_scrape",
      status: "pending",
      progress: {
        totalSources: args.totalSources,
        processedSources: 0,
        successfulScrapes: 0,
        failedScrapes: 0,
        totalEventsFound: 0,
        currentSource: null,
      },
      startedAt: Date.now(),
    });
  },
});

export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("jobs"),
    progress: v.object({
      processedEvents: v.optional(v.number()),
      processedSources: v.optional(v.number()),
      successfulScrapes: v.optional(v.number()),
      failedScrapes: v.optional(v.number()),
      totalEventsFound: v.optional(v.number()),
      currentEvent: v.optional(v.union(v.string(), v.null())),
      currentSource: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Create a copy of the current progress
    const updatedProgress: any = { ...job.progress };
    
    // Update only the fields that are provided
    if (args.progress.processedEvents !== undefined) {
      updatedProgress.processedEvents = args.progress.processedEvents;
    }
    if (args.progress.processedSources !== undefined) {
      updatedProgress.processedSources = args.progress.processedSources;
    }
    if (args.progress.successfulScrapes !== undefined) {
      updatedProgress.successfulScrapes = args.progress.successfulScrapes;
    }
    if (args.progress.failedScrapes !== undefined) {
      updatedProgress.failedScrapes = args.progress.failedScrapes;
    }
    if (args.progress.totalEventsFound !== undefined) {
      updatedProgress.totalEventsFound = args.progress.totalEventsFound;
    }
    if (args.progress.currentEvent !== undefined) {
      updatedProgress.currentEvent = args.progress.currentEvent;
    }
    if (args.progress.currentSource !== undefined) {
      updatedProgress.currentSource = args.progress.currentSource;
    }

    await ctx.db.patch(args.jobId, {
      progress: updatedProgress,
    });
  },
});

export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      status: args.status,
    };

    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = Date.now();
    }

    if (args.error) {
      updates.error = args.error;
    }

    await ctx.db.patch(args.jobId, updates);
  },
});

// Internal actions
export const processBatchEventScrapeJob = internalAction({
  args: {
    jobId: v.id("jobs"),
    eventIds: v.array(v.id("events")),
  },
  handler: async (ctx, args) => {
    try {
      // Mark job as running
      await ctx.runMutation(internal.jobs.updateJobStatus, {
        jobId: args.jobId,
        status: "running",
      });

      let successfulScrapes = 0;
      let failedScrapes = 0;

      for (let i = 0; i < args.eventIds.length; i++) {
        const eventId = args.eventIds[i];
        
        try {
          // Get event details for progress tracking
          const event = await ctx.runQuery(internal.eventsInternal.getEventById, { eventId });
          
          // Update progress with current event
          await ctx.runMutation(internal.jobs.updateJobProgress, {
            jobId: args.jobId,
            progress: {
              processedEvents: i,
              currentEvent: event?.title || "Unknown Event",
            },
          });

          // Perform the scrape
          const result = await ctx.runAction(internal.eventsInternal.performEventScrape, {
            eventId,
          });

          if (result.success) {
            successfulScrapes++;
          } else {
            failedScrapes++;
          }
        } catch (error) {
          console.error(`Failed to scrape event ${eventId}:`, error);
          failedScrapes++;
        }

        // Update progress
        await ctx.runMutation(internal.jobs.updateJobProgress, {
          jobId: args.jobId,
          progress: {
            processedEvents: i + 1,
            successfulScrapes,
            failedScrapes,
            currentEvent: null,
          },
        });
      }

      // Mark job as completed
      await ctx.runMutation(internal.jobs.updateJobStatus, {
        jobId: args.jobId,
        status: "completed",
      });

    } catch (error) {
      console.error("Batch event scrape job failed:", error);
      
      // Mark job as failed
      await ctx.runMutation(internal.jobs.updateJobStatus, {
        jobId: args.jobId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

export const processBatchSourceScrapeJob = internalAction({
  args: {
    jobId: v.id("jobs"),
    sourceIds: v.array(v.id("eventSources")),
  },
  handler: async (ctx, args) => {
    try {
      // Mark job as running
      await ctx.runMutation(internal.jobs.updateJobStatus, {
        jobId: args.jobId,
        status: "running",
      });

      let successfulScrapes = 0;
      let failedScrapes = 0;
      let totalEventsFound = 0;

      for (let i = 0; i < args.sourceIds.length; i++) {
        const sourceId = args.sourceIds[i];
        
        try {
          // Get source details for progress tracking
          const source = await ctx.runQuery(internal.eventSources.getSourceById, { sourceId });
          
          // Update progress with current source
          await ctx.runMutation(internal.jobs.updateJobProgress, {
            jobId: args.jobId,
            progress: {
              processedSources: i,
              currentSource: source?.name || "Unknown Source",
            },
          });

          // Perform the scrape
          const result = await ctx.runAction(internal.eventSources.performSourceScrape, {
            sourceId,
          });

          if (result.success) {
            successfulScrapes++;
            totalEventsFound += result.eventsFound || 0;
          } else {
            failedScrapes++;
          }
        } catch (error) {
          console.error(`Failed to scrape source ${sourceId}:`, error);
          failedScrapes++;
        }

        // Update progress
        await ctx.runMutation(internal.jobs.updateJobProgress, {
          jobId: args.jobId,
          progress: {
            processedSources: i + 1,
            successfulScrapes,
            failedScrapes,
            totalEventsFound,
            currentSource: null,
          },
        });
      }

      // Mark job as completed
      await ctx.runMutation(internal.jobs.updateJobStatus, {
        jobId: args.jobId,
        status: "completed",
      });

    } catch (error) {
      console.error("Batch source scrape job failed:", error);
      
      // Mark job as failed
      await ctx.runMutation(internal.jobs.updateJobStatus, {
        jobId: args.jobId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
