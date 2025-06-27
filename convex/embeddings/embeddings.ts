import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { EmbeddingResult } from "./common";

// PUBLIC ACTIONS - No authentication required (but could be added if needed)

export const generateEventEmbedding = action({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<EmbeddingResult> => {
    console.log("🔮 Public request to generate event embedding:", args.eventId);

    const result = await ctx.runAction(
      internal.embeddings.embeddingsInternal.generateEventDescriptionEmbedding,
      {
        eventId: args.eventId,
      },
    );

    console.log("🔮 Public event embedding result:", {
      success: result.success,
      eventId: args.eventId,
    });

    return result;
  },
});
