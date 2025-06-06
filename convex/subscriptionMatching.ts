import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

// Magic constant for similarity threshold
const SIMILARITY_THRESHOLD = 0.2; // Events below this score are excluded

// Helper function to get isActive status from either field
function getIsActive(subscription: any): boolean {
  if (subscription.isActive !== undefined) {
    return subscription.isActive;
  }
  // Fallback to old status field
  return subscription.status === "active";
}

// Helper function to calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Preview showing all events but marking those below threshold
export const previewMatchingEvents = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<any[]> => {
    if (!args.prompt.trim()) {
      return [];
    }

    const now = Date.now();

    try {
      // Generate embedding for the prompt
      const promptEmbedding: number[] = await ctx.runAction(internal.embeddings.generateEmbedding, {
        text: args.prompt,
      });

      // Use vector search to find similar events
      const embeddingResults: any[] = await ctx.runQuery(internal.subscriptionQueries.searchEventsByEmbedding, {
        embedding: promptEmbedding,
      });

      // Also do text search for comparison
      const titleResults: any[] = await ctx.runQuery(internal.subscriptionQueries.searchEventsByTitle, {
        searchTerm: args.prompt,
      });

      // Combine results and add source information
      const allResults = [
        ...embeddingResults.map((event: any) => ({
          ...event,
          matchType: "semantic",
          score: event._score || 0,
        })),
        ...titleResults.map((event: any) => ({
          ...event,
          matchType: "title",
          score: event._score || 0,
        }))
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
      const titleResults: any[] = await ctx.runQuery(internal.subscriptionQueries.searchEventsByTitle, {
        searchTerm: args.prompt,
      });

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
    const subscription = await ctx.runQuery(internal.subscriptionQueries.getSubscriptionById, {
      subscriptionId: args.subscriptionId,
    });

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
        promptEmbedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
          text: subscription.prompt,
        });
      }

      // Use vector search to find similar events
      const embeddingResults: any[] = await ctx.runQuery(internal.subscriptionQueries.searchEventsByEmbedding, {
        embedding: promptEmbedding,
      });

      // Also do text search
      const titleResults: any[] = await ctx.runQuery(internal.subscriptionQueries.searchEventsByTitle, {
        searchTerm: subscription.prompt,
      });

      // Combine results
      const allResults = [
        ...embeddingResults.map((event: any) => ({
          ...event,
          matchType: "semantic",
          score: event._score || 0,
        })),
        ...titleResults.map((event: any) => ({
          ...event,
          matchType: "title", 
          score: event._score || 0,
        }))
      ];

      // Deduplicate by ID, keeping the one with higher score
      const uniqueResults = new Map();
      allResults.forEach((event: any) => {
        const existing = uniqueResults.get(event._id);
        if (!existing || event.score > existing.score) {
          uniqueResults.set(event._id, event);
        }
      });

      // Filter by similarity threshold and future events only
      const filteredResults = Array.from(uniqueResults.values()).filter((event: any) => {
        // Must be above similarity threshold
        if (event.score < SIMILARITY_THRESHOLD) return false;
        // Must be a future event
        if (event.eventDate <= now) return false;
        return true;
      });

      // Add matching events to the email queue
      for (const event of filteredResults.slice(0, maxResults)) {
        await ctx.runMutation(internal.emailQueue.addToQueue, {
          subscriptionId: args.subscriptionId,
          eventId: event._id,
          matchScore: event.score,
          matchType: event.matchType,
        });
      }

      // Sort by score and limit results
      return filteredResults
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, maxResults);

    } catch (error) {
      console.error("Error finding matching events for subscription:", error);
      return [];
    }
  },
});

// Internal version for cron jobs
export const findMatchingEventsForSubscriptionInternal = internalAction({
  args: {
    subscriptionId: v.id("subscriptions"),
    maxResults: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"events">[]> => {
    const subscription = await ctx.runQuery(internal.subscriptionQueries.getSubscriptionById, {
      subscriptionId: args.subscriptionId,
    });

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
        promptEmbedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
          text: subscription.prompt,
        });
      }

      // Use vector search to find similar events
      const embeddingResults: any[] = await ctx.runQuery(internal.subscriptionQueries.searchEventsByEmbedding, {
        embedding: promptEmbedding,
      });

      // Also do text search
      const titleResults: any[] = await ctx.runQuery(internal.subscriptionQueries.searchEventsByTitle, {
        searchTerm: subscription.prompt,
      });

      // Combine results
      const allResults = [
        ...embeddingResults.map((event: any) => ({
          ...event,
          matchType: "semantic",
          score: event._score || 0,
        })),
        ...titleResults.map((event: any) => ({
          ...event,
          matchType: "title", 
          score: event._score || 0,
        }))
      ];

      // Deduplicate by ID, keeping the one with higher score
      const uniqueResults = new Map();
      allResults.forEach((event: any) => {
        const existing = uniqueResults.get(event._id);
        if (!existing || event.score > existing.score) {
          uniqueResults.set(event._id, event);
        }
      });

      // Filter by similarity threshold and future events only
      const filteredResults = Array.from(uniqueResults.values()).filter((event: any) => {
        // Must be above similarity threshold
        if (event.score < SIMILARITY_THRESHOLD) return false;
        // Must be a future event
        if (event.eventDate <= now) return false;
        return true;
      });

      // Add matching events to the email queue
      for (const event of filteredResults.slice(0, maxResults)) {
        await ctx.runMutation(internal.emailQueue.addToQueue, {
          subscriptionId: args.subscriptionId,
          eventId: event._id,
          matchScore: event.score,
          matchType: event.matchType,
        });
      }

      // Sort by score and limit results
      return filteredResults
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, maxResults);

    } catch (error) {
      console.error("Error finding matching events for subscription:", error);
      return [];
    }
  },
});

// New function to process a single event for subscription matching
export const processEventForSubscriptionMatching = internalAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`Processing event ${args.eventId} for subscription matching`);

      // Get the event
      const event = await ctx.runQuery(internal.eventsInternal.getEventById, {
        eventId: args.eventId,
      });

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
      const subscriptions = await ctx.runQuery(internal.subscriptionQueries.getActiveSubscriptions);
      
      if (subscriptions.length === 0) {
        console.log("No active subscriptions found");
        return;
      }

      console.log(`Found ${subscriptions.length} active subscriptions to check against event`);

      // Check this event against each subscription
      for (const subscription of subscriptions) {
        try {
          await checkEventAgainstSubscription(ctx, args.eventId, subscription);
        } catch (error) {
          console.error(`Error checking event ${args.eventId} against subscription ${subscription._id}:`, error);
        }
      }

      console.log(`Completed subscription matching for event ${args.eventId}`);
    } catch (error) {
      console.error(`Error in processEventForSubscriptionMatching for event ${args.eventId}:`, error);
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
    await ctx.runAction(internal.subscriptionMatching.processEventForSubscriptionMatching, {
      eventId: args.eventId,
    });
    
    return { success: true, message: "Subscription matching triggered successfully" };
  },
});

// Helper function to check a single event against a single subscription
async function checkEventAgainstSubscription(ctx: any, eventId: any, subscription: any) {
  try {
    let promptEmbedding: number[] | undefined;
    
    // Use existing embedding if available, otherwise generate it
    if (subscription.promptEmbedding) {
      promptEmbedding = subscription.promptEmbedding;
    } else {
      promptEmbedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
        text: subscription.prompt,
      });
    }

    const event = await ctx.runQuery(internal.eventsInternal.getEventById, { eventId });
    if (!event) return;

    // Calculate semantic similarity if event has embedding
    let semanticScore = 0;
    if (event.descriptionEmbedding && promptEmbedding) {
      semanticScore = cosineSimilarity(promptEmbedding, event.descriptionEmbedding);
    }

    // Calculate text similarity (simple keyword matching)
    let textScore = 0;
    const promptWords = subscription.prompt.toLowerCase().split(/\s+/);
    const eventText = (event.title + " " + event.description).toLowerCase();
    const matchingWords = promptWords.filter((word: string) => eventText.includes(word));
    textScore = matchingWords.length / promptWords.length;

    // Use the higher score
    const finalScore = Math.max(semanticScore, textScore);
    const matchType = semanticScore > textScore ? "semantic" : "title";

    // Only add to queue if above threshold
    if (finalScore >= SIMILARITY_THRESHOLD) {
      await ctx.runMutation(internal.emailQueue.addToQueue, {
        subscriptionId: subscription._id,
        eventId: eventId,
        matchScore: finalScore,
        matchType: matchType,
      });

      console.log(`Added event ${eventId} to queue for subscription ${subscription._id} with score ${finalScore.toFixed(3)}`);
    }
  } catch (error) {
    console.error(`Error checking event ${eventId} against subscription ${subscription._id}:`, error);
  }
}
