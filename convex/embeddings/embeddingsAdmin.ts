import { action, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { adminAction, adminQuery } from "../utils";
import {
  BatchEmbeddingResult,
  EmbeddingGenerationStats,
  EmbeddingResult,
} from "./common";

// ADMIN QUERIES

export const getEmbeddingStats = adminAction({
  args: {},
  handler: async (ctx, args): Promise<EmbeddingGenerationStats> => {
    return await ctx.runAction(
      internal.embeddings.embeddingsInternal.getEmbeddingStats,
    );
  },
});

// ADMIN ACTIONS

export const generateMissingEmbeddings = adminAction({
  args: {},
  handler: async (ctx, args): Promise<BatchEmbeddingResult> => {
    console.log("🔧 Admin: Starting batch generation of missing embeddings");

    try {
      // Get all events without embeddings
      const eventsWithoutEmbeddings = await ctx.runQuery(
        internal.embeddingQueries.getEventsWithoutEmbeddings,
      );

      if (eventsWithoutEmbeddings.length === 0) {
        console.log("✅ No events missing embeddings");
        return {
          success: true,
          processed: 0,
          failed: 0,
          total: 0,
        };
      }

      console.log(
        `📊 Found ${eventsWithoutEmbeddings.length} events without embeddings`,
      );

      // Extract event IDs
      const eventIds = eventsWithoutEmbeddings.map((event: any) => event._id);

      // Run batch embedding generation
      const result = await ctx.runAction(
        internal.embeddings.embeddingsInternal.batchGenerateEventEmbeddings,
        {
          eventIds,
        },
      );

      console.log("🔧 Admin batch embedding generation completed:", result);
      return result;
    } catch (error) {
      console.error("❌ Admin batch embedding generation failed:", error);
      return {
        success: false,
        processed: 0,
        failed: 0,
        total: 0,
      };
    }
  },
});

export const forceRegenerateEventEmbedding = adminAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<EmbeddingResult> => {
    console.log(
      "🔧 Admin: Force regenerating embedding for event:",
      args.eventId,
    );

    const result = await ctx.runAction(
      internal.embeddings.embeddingsInternal.generateEventDescriptionEmbedding,
      {
        eventId: args.eventId,
      },
    );

    console.log("🔧 Admin force regenerate result:", {
      success: result.success,
      eventId: args.eventId,
    });

    return result;
  },
});

export const batchRegenerateEmbeddings = adminAction({
  args: {
    eventIds: v.array(v.id("events")),
  },
  handler: async (ctx, args): Promise<BatchEmbeddingResult> => {
    console.log(
      `🔧 Admin: Batch regenerating embeddings for ${args.eventIds.length} events`,
    );

    const result = await ctx.runAction(
      internal.embeddings.embeddingsInternal.batchGenerateEventEmbeddings,
      {
        eventIds: args.eventIds,
      },
    );

    console.log("🔧 Admin batch regenerate completed:", result);
    return result;
  },
});

export const generateSubscriptionEmbedding = adminAction({
  args: {
    subscriptionId: v.id("subscriptions"),
  },
  handler: async (ctx, args): Promise<EmbeddingResult> => {
    console.log(
      "🔧 Admin: Generating subscription embedding:",
      args.subscriptionId,
    );

    const result = await ctx.runAction(
      internal.embeddings.embeddingsInternal.generateSubscriptionEmbedding,
      {
        subscriptionId: args.subscriptionId,
      },
    );

    console.log("🔧 Admin subscription embedding result:", {
      success: result.success,
      subscriptionId: args.subscriptionId,
    });

    return result;
  },
});

export const testEmbeddingGeneration = adminAction({
  args: {
    text: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    embedding?: number[];
    error?: string;
  }> => {
    console.log(
      "🔧 Admin: Testing embedding generation for text:",
      args.text.substring(0, 100),
    );

    try {
      const embedding = await ctx.runAction(
        internal.embeddings.embeddingsInternal.generateEmbedding,
        {
          text: args.text,
        },
      );

      console.log(
        `✅ Test embedding generated successfully (${embedding.length} dimensions)`,
      );
      return {
        success: true,
        embedding,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Test embedding generation failed:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
