import { action, internalAction, ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  EventSearchResult,
  SIMILARITY_THRESHOLD,
  getIsActive,
  cosineSimilarity,
} from "./common";

// Preview showing all events but marking those below threshold
export const previewMatchingEvents = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<EventSearchResult[]> => {
    if (!args.prompt.trim()) {
      return [];
    }

    const now = Date.now();

    try {
      // Generate embedding for the prompt
      const promptEmbedding: number[] = await ctx.runAction(
        internal.embeddings.generateEmbedding,
        {
          text: args.prompt,
        },
      );

      // Use vector search to find similar events
      const embeddingResults: Doc<"events">[] = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.searchEventsByEmbedding,
        {
          embedding: promptEmbedding,
        },
      );

      // Also do text search for comparison
      const titleResults: Doc<"events">[] = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.searchEventsByTitle,
        {
          searchTerm: args.prompt,
        },
      );

      // Combine results and add source information
      const allResults: EventSearchResult[] = [
        ...embeddingResults.map(
          (event): EventSearchResult => ({
            ...event,
            matchType: "semantic",
            score: (event as any)._score || 0,
          }),
        ),
        ...titleResults.map(
          (event): EventSearchResult => ({
            ...event,
            matchType: "title",
            score: (event as any)._score || 0,
          }),
        ),
      ];

      // Deduplicate by ID, keeping the one with higher score
      const uniqueResults = new Map();
      allResults.forEach((event: any) => {
        const existing = uniqueResults.get(event._id);
        if (!existing || event.score > existing.score) {
          uniqueResults.set(event._id, event);
        }
      });

      // Filter to only future events and add threshold status
      const filteredResults = Array.from(uniqueResults.values())
        .filter((event: any) => event.eventDate > now)
        .map((event: any) => ({
          ...event,
          meetsThreshold: event.score >= SIMILARITY_THRESHOLD,
          thresholdValue: SIMILARITY_THRESHOLD,
        }));

      // Sort by score (highest first) and return results
      return filteredResults
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 15); // Show more results since we're including below-threshold ones
    } catch (error) {
      console.error("Error in previewMatchingEvents:", error);

      // Fallback to text search only
      const titleResults: any[] = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.searchEventsByTitle,
        {
          searchTerm: args.prompt,
        },
      );

      // Filter to only future events and add threshold status
      const filteredResults = titleResults
        .map((event: any) => ({
          ...event,
          matchType: "title",
          score: event._score || 0,
          meetsThreshold: (event._score || 0) >= SIMILARITY_THRESHOLD,
          thresholdValue: SIMILARITY_THRESHOLD,
        }))
        .filter((event: any) => event.eventDate > now);

      // Sort by score and return
      return filteredResults
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 15);
    }
  },
});

// Function to find matching events for notifications (used by notification system)
export const findMatchingEventsForSubscription = action({
  args: {
    subscriptionId: v.id("subscriptions"),
    maxResults: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"events">[]> => {
    const subscription = await ctx.runQuery(
      internal.subscriptions.subscriptionsInternal.getSubscriptionById,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    if (!subscription || !getIsActive(subscription)) {
      return [];
    }

    const now = Date.now();
    const maxResults = args.maxResults || 10;

    try {
      let promptEmbedding: number[] | undefined;

      // Use existing embedding if available, otherwise generate it
      if (subscription.promptEmbedding) {
        promptEmbedding = subscription.promptEmbedding;
      } else {
        promptEmbedding = await ctx.runAction(
          internal.embeddings.generateEmbedding,
          {
            text: subscription.prompt,
          },
        );
      }

      // Use vector search to find similar events
      const embeddingResults: any[] = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.searchEventsByEmbedding,
        {
          embedding: promptEmbedding,
        },
      );

      // Also do text search
      const titleResults: any[] = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.searchEventsByTitle,
        {
          searchTerm: subscription.prompt,
        },
      );

      // Combine and deduplicate results
      const allResults = [...embeddingResults, ...titleResults];
      const uniqueResults = new Map();
      allResults.forEach((event: any) => {
        const existing = uniqueResults.get(event._id);
        if (!existing || (event._score || 0) > (existing._score || 0)) {
          uniqueResults.set(event._id, event);
        }
      });

      // Filter to only future events that meet the threshold
      const filteredResults = Array.from(uniqueResults.values())
        .filter((event: any) => {
          return (
            event.eventDate > now && (event._score || 0) >= SIMILARITY_THRESHOLD
          );
        })
        .sort((a: any, b: any) => (b._score || 0) - (a._score || 0))
        .slice(0, maxResults);

      return filteredResults;
    } catch (error) {
      console.error("Error finding matching events:", error);

      // Fallback to text search only
      const titleResults: any[] = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.searchEventsByTitle,
        {
          searchTerm: subscription.prompt,
        },
      );

      return titleResults
        .filter(
          (event: any) =>
            event.eventDate > now &&
            (event._score || 0) >= SIMILARITY_THRESHOLD,
        )
        .sort((a: any, b: any) => (b._score || 0) - (a._score || 0))
        .slice(0, maxResults);
    }
  },
});

// Check a single event against a single subscription
async function checkEventAgainstSubscription(
  ctx: ActionCtx,
  eventId: Id<"events">,
  subscription: Doc<"subscriptions">,
) {
  try {
    console.log(
      `🔍 Checking event ${eventId} against subscription ${subscription._id}`,
    );

    // Get the event
    const event = await ctx.runQuery(
      internal.events.eventsInternal.getEventById,
      {
        eventId,
      },
    );

    if (!event) {
      console.log(`Event ${eventId} not found`);
      return;
    }

    // Skip past events
    if (event.eventDate <= Date.now()) {
      console.log(`Event ${eventId} is in the past, skipping`);
      return;
    }

    let matchScore = 0;
    let matchType = "none";

    // If subscription has an embedding, use semantic matching
    if (subscription.promptEmbedding && event.descriptionEmbedding) {
      const similarity = cosineSimilarity(
        subscription.promptEmbedding,
        event.descriptionEmbedding,
      );
      if (similarity >= SIMILARITY_THRESHOLD) {
        matchScore = similarity;
        matchType = "semantic";
      }
    }

    // Also try text-based matching as fallback
    if (matchScore === 0) {
      const prompt = subscription.prompt.toLowerCase();
      const title = event.title.toLowerCase();
      const description = event.description.toLowerCase();

      // Simple keyword matching
      const keywords = prompt.split(/\s+/).filter((word) => word.length > 2);
      let keywordMatches = 0;

      for (const keyword of keywords) {
        if (title.includes(keyword) || description.includes(keyword)) {
          keywordMatches++;
        }
      }

      if (keywordMatches > 0) {
        matchScore = keywordMatches / keywords.length;
        matchType = "keyword";

        // Only proceed if the match score meets a lower threshold for keyword matching
        if (matchScore < 0.3) {
          matchScore = 0;
          matchType = "none";
        }
      }
    }

    // If we have a match, queue it for email
    if (matchScore > 0) {
      console.log(
        `✅ Match found! Event ${eventId} matches subscription ${subscription._id} with score ${matchScore} (type: ${matchType})`,
      );

      await ctx.runMutation(internal.emailQueue.addToQueue, {
        subscriptionId: subscription._id,
        eventId,
        matchScore,
        matchType,
      });
    } else {
      console.log(
        `❌ No match: Event ${eventId} does not match subscription ${subscription._id}`,
      );
    }
  } catch (error) {
    console.error(
      `Error checking event ${eventId} against subscription ${subscription._id}:`,
      error,
    );
  }
}

// New function to process a single event for subscription matching
export const processEventForSubscriptionMatching = internalAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Processing event ${args.eventId} for subscription matching`);

      // Get the event
      const event = await ctx.runQuery(
        internal.events.eventsInternal.getEventById,
        {
          eventId: args.eventId,
        },
      );

      if (!event) {
        console.log(`Event ${args.eventId} not found`);
        return;
      }

      // Only process future events
      if (event.eventDate <= Date.now()) {
        console.log(`Event ${args.eventId} is in the past, skipping`);
        return;
      }

      // Get all active subscriptions
      const subscriptions = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.getActiveSubscriptions,
      );

      if (subscriptions.length === 0) {
        console.log("No active subscriptions found");
        return;
      }

      console.log(
        `Found ${subscriptions.length} active subscriptions to check against event`,
      );

      // Check this event against each subscription
      for (const subscription of subscriptions) {
        try {
          await checkEventAgainstSubscription(ctx, args.eventId, subscription);
        } catch (error) {
          console.error(
            `Error checking event ${args.eventId} against subscription ${subscription._id}:`,
            error,
          );
        }
      }

      console.log(`Completed subscription matching for event ${args.eventId}`);
    } catch (error) {
      console.error(
        `Error in processEventForSubscriptionMatching for event ${args.eventId}:`,
        error,
      );
    }
  },
});

// Public action to trigger subscription matching immediately (for admin use)
export const triggerSubscriptionMatchingForEvent = action({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    // This is a public action that can be called from the frontend
    // It will trigger the internal subscription matching process immediately
    await ctx.runAction(
      internal.subscriptions.subscriptionsMatching
        .processEventForSubscriptionMatching,
      {
        eventId: args.eventId,
      },
    );

    return {
      success: true,
      message: "Subscription matching triggered successfully",
    };
  },
});
