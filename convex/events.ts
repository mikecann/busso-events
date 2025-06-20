import { query, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

// Helper function to check if user is admin (for actions)
async function requireAdminAction(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be authenticated");
  }

  // Use internal query to check admin status
  const isAdmin = await ctx.runQuery(internal.eventsInternal.checkUserIsAdmin, {
    userId,
  });
  if (!isAdmin) {
    throw new Error("Admin access required");
  }
  return userId;
}

// PUBLIC QUERIES - No authentication required
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("events").order("desc").collect();
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
    return await ctx.runQuery(internal.eventsInternal.getEventWorkpoolStatus, {
      eventId: args.eventId,
    });
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
      internal.eventsInternal.getEventEmbeddingWorkpoolStatus,
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
    const now = Date.now();
    let maxDate: number | undefined;

    // Calculate the maximum date based on filter
    if (args.dateFilter && args.dateFilter !== "all") {
      switch (args.dateFilter) {
        case "week":
          maxDate = now + 7 * 24 * 60 * 60 * 1000; // 1 week
          break;
        case "month":
          maxDate = now + 30 * 24 * 60 * 60 * 1000; // 30 days
          break;
        case "3months":
          maxDate = now + 90 * 24 * 60 * 60 * 1000; // 90 days
          break;
      }
    }

    let results: any[] = [];

    if (!args.searchTerm.trim()) {
      // No search term, just get all events and filter by date
      const allEvents = await ctx.db
        .query("events")
        .withIndex("by_event_date")
        .order("asc")
        .collect();

      results = allEvents.filter((event) => {
        // Only show future events
        if (event.eventDate <= now) return false;
        // Apply date filter if specified
        if (maxDate && event.eventDate > maxDate) return false;
        return true;
      });
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
      const uniqueResults = allResults.filter(
        (event, index, self) =>
          index === self.findIndex((e) => e._id === event._id),
      );

      // Apply date filters
      results = uniqueResults.filter((event) => {
        // Only show future events
        if (event.eventDate <= now) return false;
        // Apply date filter if specified
        if (maxDate && event.eventDate > maxDate) return false;
        return true;
      });
    }

    // Sort by event date (ascending - soonest first)
    return results.sort((a, b) => a.eventDate - b.eventDate);
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
      internal.eventsInternal.performEventScrape,
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
