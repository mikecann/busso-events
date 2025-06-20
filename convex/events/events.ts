import { query, action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import {
  requireAdminAction,
  calculateMaxDateFromFilter,
  filterEventsByDate,
  deduplicateEvents,
  sortEventsByDate,
} from "./common";

// PUBLIC QUERIES - No authentication required
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("events").order("desc").take(69);
  },
});

export const getById = query({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getWorkpoolStatus = query({
  args: { eventId: v.id("events") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    workId: string;
    enqueuedAt: number | undefined;
    status: any;
    error?: string;
  } | null> => {
    // This is a public query but we'll call the internal one
    return await ctx.runQuery(
      internal.events.eventsInternal.getEventWorkpoolStatus,
      {
        eventId: args.eventId,
      },
    );
  },
});

export const getEmbeddingWorkpoolStatus = query({
  args: { eventId: v.id("events") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    workId: string;
    enqueuedAt: number | undefined;
    status: any;
    error?: string;
  } | null> => {
    // This is a public query but we'll call the internal one
    return await ctx.runQuery(
      internal.events.eventsInternal.getEventEmbeddingWorkpoolStatus,
      {
        eventId: args.eventId,
      },
    );
  },
});

export const search = query({
  args: {
    searchTerm: v.string(),
    dateFilter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("week"),
        v.literal("month"),
        v.literal("3months"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let results: any[] = [];

    if (!args.searchTerm.trim()) {
      // No search term, just get all events and filter by date
      const allEvents = await ctx.db
        .query("events")
        .withIndex("by_event_date")
        .order("asc")
        .collect();

      results = filterEventsByDate(allEvents, args.dateFilter);
    } else {
      // Search with text and apply date filter
      const titleResults = await ctx.db
        .query("events")
        .withSearchIndex("search_title", (q) =>
          q.search("title", args.searchTerm),
        )
        .collect();

      const descriptionResults = await ctx.db
        .query("events")
        .withSearchIndex("search_description", (q) =>
          q.search("description", args.searchTerm),
        )
        .collect();

      // Combine and deduplicate results
      const allResults = [...titleResults, ...descriptionResults];
      const uniqueResults = deduplicateEvents(allResults);

      // Apply date filters
      results = filterEventsByDate(uniqueResults, args.dateFilter);
    }

    // Sort by event date (ascending - soonest first)
    return sortEventsByDate(results);
  },
});

// ADMIN ACTIONS
export const testScrapeEvent = action({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);

    // Call the event-specific scraping action
    const result: any = await ctx.runAction(api.scraping.scrapeEventPage, {
      url: args.url,
    });

    return result;
  },
});

export const startScrapeNow = action({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);

    // Call the internal scrape action
    const result: any = await ctx.runAction(
      internal.events.eventsInternal.performEventScrape,
      {
        eventId: args.eventId,
      },
    );

    return result;
  },
});

export const generateMissingEmbeddings = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    total: number;
  }> => {
    await requireAdminAction(ctx);

    return await ctx.runAction(api.embeddings.generateMissingEmbeddings);
  },
});
