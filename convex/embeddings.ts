import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import OpenAI from "openai";
import { isPromptSubscription } from "./subscriptions/common";

const openai = new OpenAI({
  //baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate embedding for a text string
export const generateEmbedding = internalAction({
  args: {
    text: v.string(),
  },
  handler: async (_ctx, args): Promise<number[]> => {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: args.text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },
});

// Update event with embedding
export const updateEventEmbedding = internalMutation({
  args: {
    eventId: v.id("events"),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.eventId, {
      descriptionEmbedding: args.embedding,
    });
  },
});

// Generate and store embedding for an event's description
export const generateEventDescriptionEmbedding = internalAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    try {
      // Get the event
      const event = await ctx.runQuery(
        internal.events.eventsInternal.getEventById,
        {
          eventId: args.eventId,
        },
      );

      if (!event) {
        throw new Error("Event not found");
      }

      // Generate embedding for the description
      const embedding = await ctx.runAction(
        internal.embeddings.generateEmbedding,
        {
          text: event.description,
        },
      );

      // Update the event with the embedding
      await ctx.runMutation(internal.embeddings.updateEventEmbedding, {
        eventId: args.eventId,
        embedding,
      });

      return { success: true };
    } catch (error) {
      console.error("Error generating event embedding:", error);
      throw error;
    }
  },
});

// Public action to generate embedding for an event (for admin use)
export const generateEventEmbedding = action({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    // This is a public action that can be called from the frontend
    return await ctx.runAction(
      internal.embeddings.generateEventDescriptionEmbedding,
      {
        eventId: args.eventId,
      },
    );
  },
});

// Generate and store embedding for a subscription's prompt
export const generateSubscriptionEmbedding = internalAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    try {
      // Get the subscription
      const subscription = await ctx.runQuery(
        internal.subscriptions.subscriptionsInternal.getSubscriptionById,
        {
          subscriptionId: args.subscriptionId,
        },
      );

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      // Only generate embeddings for prompt-based subscriptions
      if (!isPromptSubscription(subscription)) {
        console.log(
          "Skipping embedding generation for non-prompt subscription",
        );
        return { success: true };
      }

      // Generate embedding for the prompt
      const embedding = await ctx.runAction(
        internal.embeddings.generateEmbedding,
        {
          text: subscription.prompt,
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

      return { success: true };
    } catch (error) {
      console.error("Error generating subscription embedding:", error);
      throw error;
    }
  },
});

// Batch generate embeddings for all events without embeddings
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
    try {
      // Get all events without embeddings
      const events = await ctx.runQuery(
        internal.embeddingQueries.getEventsWithoutEmbeddings,
      );

      let processed = 0;
      let failed = 0;

      for (const event of events) {
        try {
          await ctx.runAction(
            internal.embeddings.generateEventDescriptionEmbedding,
            {
              eventId: event._id,
            },
          );
          processed++;
        } catch (error) {
          console.error(
            `Failed to generate embedding for event ${event._id}:`,
            error,
          );
          failed++;
        }
      }

      return {
        success: true,
        processed,
        failed,
        total: events.length,
      };
    } catch (error) {
      console.error("Error in batch embedding generation:", error);
      throw error;
    }
  },
});
