import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ScrapeResult, EventPageScrapeResult } from "./common";

// PUBLIC ACTIONS - Require authentication

export const scrapeUrl = action({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args): Promise<ScrapeResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated to scrape URLs");
    }

    return await ctx.runAction(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: args.url,
      },
    );
  },
});

export const scrapeEventPage = action({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args): Promise<EventPageScrapeResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated to scrape event pages");
    }

    return await ctx.runAction(
      internal.scraping.scrapingInternal.scrapeEventPageInternal,
      {
        url: args.url,
      },
    );
  },
});
