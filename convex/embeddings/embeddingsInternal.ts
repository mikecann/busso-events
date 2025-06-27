import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import OpenAI from "openai";
import { isPromptSubscription } from "../subscriptions/common";
import {
  EmbeddingResult,
  BatchEmbeddingResult,
  EmbeddingGenerationStats,
  EMBEDDING_CONSTANTS,
  validateEmbeddingText,
  validateEmbeddingArray,
  prepareEventTextForEmbedding,
  prepareSubscriptionTextForEmbedding,
  formatEmbeddingError,
  shouldRetryEmbeddingError,
  delay,
  chunkArray,
} from "./common";
import { Doc, Id } from "../_generated/dataModel";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// INTERNAL ACTIONS

export const generateEmbedding = internalAction({
  args: {
    text: v.string(),
  },
  handler: async (_ctx, args): Promise<number[]> => {
    try {
      validateEmbeddingText(args.text);

      const response = await openai.embeddings.create({
        model: EMBEDDING_CONSTANTS.OPENAI_MODEL,
        input: args.text,
      });

      const embedding = response.data[0].embedding;
      validateEmbeddingArray(embedding);

      return embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error(formatEmbeddingError("generate embedding", error));
    }
  },
});

export const generateEventDescriptionEmbedding = internalAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<EmbeddingResult> => {
    try {
      console.log(`🔮 Generating embedding for event: ${args.eventId}`);

      // Get the event
      const event = await ctx.runQuery(
        internal.events.eventsInternal.getEventById,
        {
          eventId: args.eventId,
        },
      );

      if (!event) {
        throw new Error(`Event with id '${args.eventId}' not found`);
      }

      // Prepare text for embedding
      const textForEmbedding = prepareEventTextForEmbedding(event);
      console.log(
        `📝 Text for embedding (${textForEmbedding.length} chars): ${textForEmbedding.substring(0, 100)}...`,
      );

      // Generate embedding
      const embedding = await ctx.runAction(
        internal.embeddings.embeddingsInternal.generateEmbedding,
        {
          text: textForEmbedding,
        },
      );

      // Update the event with the embedding
      await ctx.runMutation(
        internal.embeddings.embeddingsInternal.updateEventEmbedding,
        {
          eventId: args.eventId,
          embedding,
        },
      );

      console.log(
        `✅ Successfully generated embedding for event: ${event.title}`,
      );
      return {
        success: true,
        message: `Generated embedding for event: ${event.title}`,
      };
    } catch (error) {
      const errorMessage = formatEmbeddingError(
        "generate event embedding",
        error,
      );
      console.error(`❌ ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }
  },
});

export const generateSubscriptionEmbedding = internalAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<EmbeddingResult> => {
    try {
      console.log(
        `🔮 Generating embedding for subscription: ${args.subscriptionId}`,
      );

      // Get the subscription
      const subscription = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.getSubscriptionById,
        {
          subscriptionId: args.subscriptionId,
        },
      );

      if (!subscription) {
        throw new Error(
          `Subscription with id '${args.subscriptionId}' not found`,
        );
      }

      // Only generate embeddings for prompt-based subscriptions
      if (!isPromptSubscription(subscription)) {
        console.log(
          "⏭️ Skipping embedding generation for non-prompt subscription",
        );
        return {
          success: true,
          message: "Skipped - not a prompt-based subscription",
        };
      }

      // Prepare text for embedding
      const textForEmbedding = prepareSubscriptionTextForEmbedding(
        subscription.prompt,
      );
      console.log(
        `📝 Prompt for embedding (${textForEmbedding.length} chars): ${textForEmbedding}`,
      );

      // Generate embedding
      const embedding = await ctx.runAction(
        internal.embeddings.embeddingsInternal.generateEmbedding,
        {
          text: textForEmbedding,
        },
      );

      // Update the subscription with the embedding
      await ctx.runMutation(
        internal.subscriptions.subscriptionsInternal
          .updateSubscriptionEmbedding,
        {
          subscriptionId: args.subscriptionId,
          embedding,
        },
      );

      console.log(
        `✅ Successfully generated embedding for subscription prompt: ${subscription.prompt}`,
      );
      return {
        success: true,
        message: `Generated embedding for subscription prompt: ${subscription.prompt}`,
      };
    } catch (error) {
      const errorMessage = formatEmbeddingError(
        "generate subscription embedding",
        error,
      );
      console.error(`❌ ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }
  },
});

export const batchGenerateEventEmbeddings = internalAction({
  args: {
    eventIds: v.array(v.id("events")),
  },
  handler: async (ctx, args): Promise<BatchEmbeddingResult> => {
    console.log(
      `🔮 Starting batch embedding generation for ${args.eventIds.length} events`,
    );

    let processed = 0;
    let failed = 0;
    const failedEvents: Id<"events">[] = [];

    // Process events in chunks to avoid overwhelming the API
    const chunks = chunkArray(args.eventIds, EMBEDDING_CONSTANTS.BATCH_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(
        `📦 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} events)`,
      );

      // Process chunk in parallel
      const chunkPromises = chunk.map(async (eventId) => {
        let attempts = 0;

        while (attempts < EMBEDDING_CONSTANTS.RETRY_ATTEMPTS) {
          try {
            const result = await ctx.runAction(
              internal.embeddings.embeddingsInternal
                .generateEventDescriptionEmbedding,
              { eventId },
            );

            if (result.success) {
              processed++;
              return { eventId, success: true };
            } else {
              throw new Error(result.message || "Unknown error");
            }
          } catch (error) {
            attempts++;

            if (
              attempts < EMBEDDING_CONSTANTS.RETRY_ATTEMPTS &&
              shouldRetryEmbeddingError(error)
            ) {
              console.log(
                `⏳ Retrying event ${eventId} (attempt ${attempts + 1}/${EMBEDDING_CONSTANTS.RETRY_ATTEMPTS})`,
              );
              await delay(EMBEDDING_CONSTANTS.RETRY_DELAY_MS * attempts);
              continue;
            }

            console.error(
              `❌ Failed to generate embedding for event ${eventId} after ${attempts} attempts:`,
              error,
            );
            failed++;
            failedEvents.push(eventId);
            return { eventId, success: false, error };
          }
        }
      });

      await Promise.all(chunkPromises);

      // Add delay between chunks to respect rate limits
      if (i < chunks.length - 1) {
        await delay(500);
      }
    }

    const result: BatchEmbeddingResult = {
      success: failed === 0,
      processed,
      failed,
      total: args.eventIds.length,
      failedEvents: failedEvents.length > 0 ? failedEvents : undefined,
    };

    console.log(`✅ Batch embedding generation completed:`, result);
    return result;
  },
});

// INTERNAL MUTATIONS

export const updateEventEmbedding = internalMutation({
  args: {
    eventId: v.id("events"),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    validateEmbeddingArray(args.embedding);

    await ctx.db.patch(args.eventId, {
      descriptionEmbedding: args.embedding,
    });
  },
});

// INTERNAL QUERIES

export const getEmbeddingStats = internalAction({
  args: {},
  handler: async (ctx, args): Promise<EmbeddingGenerationStats> => {
    try {
      // Get events without embeddings
      const eventsWithoutEmbeddings: any[] = await ctx.runQuery(
        internal.embeddingQueries.getEventsWithoutEmbeddings,
      );

      // For now, we'll calculate with placeholder values since we don't have getEventsWithEmbeddings
      // This would need to be implemented properly
      const totalEvents = eventsWithoutEmbeddings.length; // This is a placeholder
      const eventsWithEmbeddings = 0; // This is a placeholder

      // Get subscription stats (this would need to be implemented in subscriptions module)
      // For now, we'll return placeholder values
      const subscriptionsWithEmbeddings = 0;
      const subscriptionsWithoutEmbeddings = 0;

      return {
        totalEvents,
        eventsWithEmbeddings,
        eventsWithoutEmbeddings: eventsWithoutEmbeddings.length,
        subscriptionsWithEmbeddings,
        subscriptionsWithoutEmbeddings,
      };
    } catch (error) {
      console.error("Error getting embedding stats:", error);
      throw error;
    }
  },
});
