import { query, action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import {
  calculateMaxDateFromFilter,
  filterEventsByDate,
  deduplicateEvents,
  sortEventsByDate,
} from "./common";
import { adminAction } from "../utils";

// Types for workpool status
interface WorkpoolStatus {
  state: "pending" | "running" | "finished" | "failed";
  previousAttempts?: number;
  retryCount?: number;
  queuePosition?: number;
  error?: string;
}

interface WorkpoolStatusResponse {
  workId: string;
  enqueuedAt: number | undefined;
  status: WorkpoolStatus | null;
  error?: string;
}

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
  handler: async (ctx, args): Promise<WorkpoolStatusResponse | null> => {
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
  handler: async (ctx, args): Promise<WorkpoolStatusResponse | null> => {
    // This is a public query but we'll call the internal one
    return await ctx.runQuery(
      internal.events.eventsInternal.getEventEmbeddingWorkpoolStatus,
      {
        eventId: args.eventId,
      },
    );
  },
});

export const getSubscriptionMatchWorkpoolStatus = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args): Promise<WorkpoolStatusResponse | null> => {
    // This is a public query but we'll call the internal one
    return await ctx.runQuery(
      internal.events.eventsInternal.getEventSubscriptionMatchWorkpoolStatus,
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
  handler: async (ctx, args): Promise<Doc<"events">[]> => {
    let results: Doc<"events">[] = [];

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

// Enhanced search action that combines text and semantic search
export const enhancedSearch = action({
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
  handler: async (
    ctx,
    args,
  ): Promise<(Doc<"events"> & { _searchType?: string; _score?: number })[]> => {
    let results: (Doc<"events"> & { _searchType?: string; _score?: number })[] =
      [];

    if (!args.searchTerm.trim()) {
      // No search term, just get all events and filter by date
      const allEvents = await ctx.runQuery(
        internal.embeddingQueries.getAllEvents,
      );
      results = filterEventsByDate(allEvents, args.dateFilter);
    } else {
      // Combine text search and semantic search
      const searchTerm = args.searchTerm.trim();

      // Text search results
      const titleResults = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.searchEventsByTitle,
        { searchTerm, limit: 50 },
      );

      // Semantic search results (if search term is meaningful)
      let embeddingResults: (Doc<"events"> & {
        _searchType: string;
        _score: number;
      })[] = [];
      if (searchTerm.length > 3) {
        try {
          // Generate embedding for the search term
          const searchEmbedding = await ctx.runAction(
            internal.embeddings.generateEmbedding,
            { text: searchTerm },
          );

          // Use ctx.vectorSearch to get semantic search results
          const vectorResults = await ctx.vectorSearch(
            "events",
            "by_embedding",
            {
              vector: searchEmbedding,
              limit: 25,
            },
          );

          // Get the full event documents for the vector search results
          embeddingResults = [];
          for (const result of vectorResults) {
            const event = await ctx.runQuery(
              internal.events.eventsInternal.getEventById,
              {
                eventId: result._id,
              },
            );
            if (event) {
              embeddingResults.push({
                ...event,
                _searchType: "semantic",
                _score: result._score,
              });
            }
          }
        } catch (error) {
          console.log("Semantic search failed, using text search only:", error);
        }
      }

      // Combine all results
      const textResults = titleResults.map((event: Doc<"events">) => ({
        ...event,
        _searchType: "text" as const,
      }));

      const allResults = [...textResults, ...embeddingResults];

      // Deduplicate results (prioritize semantic matches)
      const uniqueResults = deduplicateEvents(allResults);

      // Apply date filters
      results = filterEventsByDate(uniqueResults, args.dateFilter);
    }

    // Sort by event date (ascending - soonest first)
    return sortEventsByDate(results);
  },
});

// ADMIN ACTIONS
export const testScrapeEvent = adminAction({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    // Call the event-specific scraping action
    const result = await ctx.runAction(api.scraping.scrapeEventPage, {
      url: args.url,
    });

    return result;
  },
});

export const startScrapeNow = adminAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<unknown> => {
    // Call the internal scrape action
    const result = await ctx.runAction(
      internal.events.eventsInternal.performEventScrape,
      {
        eventId: args.eventId,
      },
    );

    return result;
  },
});

export const generateMissingEmbeddings = adminAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    total: number;
  }> => {
    return await ctx.runAction(api.embeddings.generateMissingEmbeddings);
  },
});
