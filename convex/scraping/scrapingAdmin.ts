import { v } from "convex/values";
import { internal } from "../_generated/api";
import { adminAction } from "../utils";
import { ScrapeResult, EventPageScrapeResult } from "./common";

// ADMIN ACTIONS - Require admin authentication

export const testScrapeUrl = adminAction({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args): Promise<ScrapeResult> => {
    console.log("🔧 Admin test scrape for URL:", args.url);

    const result = await ctx.runAction(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: args.url,
      },
    );

    console.log("🔧 Admin test scrape result:", {
      success: result.success,
      eventsFound: result.data?.extractedEvents?.length || 0,
    });

    return result;
  },
});

export const testScrapeEventPage = adminAction({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args): Promise<EventPageScrapeResult> => {
    console.log("🔧 Admin test event page scrape for URL:", args.url);

    const result = await ctx.runAction(
      internal.scraping.scrapingInternal.scrapeEventPageInternal,
      {
        url: args.url,
      },
    );

    console.log("🔧 Admin test event page scrape result:", {
      success: result.success,
      eventDetails: result.data?.eventDetails || null,
    });

    return result;
  },
});

// Batch scraping function for testing multiple URLs
export const batchTestScrape = adminAction({
  args: {
    urls: v.array(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    results: ScrapeResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      totalEventsFound: number;
    };
  }> => {
    console.log("🔧 Admin batch test scrape for URLs:", args.urls);

    const results: ScrapeResult[] = [];
    let successful = 0;
    let failed = 0;
    let totalEventsFound = 0;

    for (const url of args.urls) {
      try {
        const result = await ctx.runAction(
          internal.scraping.scrapingInternal.scrapeUrlInternal,
          {
            url,
          },
        );

        results.push(result);

        if (result.success) {
          successful++;
          totalEventsFound += result.data?.extractedEvents?.length || 0;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        results.push({
          success: false,
          message: `Failed to scrape: ${error instanceof Error ? error.message : "Unknown error"}`,
          data: null,
        });
        failed++;
      }
    }

    const summary = {
      total: args.urls.length,
      successful,
      failed,
      totalEventsFound,
    };

    console.log("🔧 Admin batch test scrape summary:", summary);

    return {
      success: true,
      results,
      summary,
    };
  },
});
