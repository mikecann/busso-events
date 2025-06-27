import { query, action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { SourceScrapeResult } from "./common";
import { Doc } from "../_generated/dataModel";

// PUBLIC QUERIES - No authentication required

export const getTestScrapeByIdPublic = query({
  args: {
    testScrapeId: v.id("testScrapes"),
  },
  handler: async (ctx, args): Promise<Doc<"testScrapes"> | null> => {
    return await ctx.db.get(args.testScrapeId);
  },
});

// Note: Most eventSources functionality requires admin access,
// so there are fewer public endpoints compared to other modules

// PUBLIC ACTIONS - No authentication required

// This could be used for webhook-triggered scraping in the future
export const triggerSourceScrape = action({
  args: {
    sourceId: v.id("eventSources"),
  },
  handler: async (ctx, args): Promise<SourceScrapeResult> => {
    console.log("🔄 Triggering source scrape for:", args.sourceId);

    const result: SourceScrapeResult = await ctx.runAction(
      internal.eventSources.eventSourcesInternal.performSourceScrape,
      {
        sourceId: args.sourceId,
      },
    );

    console.log("🔄 Source scrape result:", {
      success: result.success,
      eventsFound: result.eventsFound,
    });
    return result;
  },
});
