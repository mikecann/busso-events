import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Authentication helper
export async function requireAuth(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be authenticated");
  }
  return userId;
}

// Helper function to get isActive status from either field (for backward compatibility)
export function getIsActive(subscription: Doc<"subscriptions">): boolean {
  if (subscription.isActive !== undefined) {
    return subscription.isActive;
  }
  // Fallback to old status field
  return subscription.status === "active";
}

// Types for queued events
export type QueuedEventItem = {
  _id: Id<"emailQueue">;
  subscriptionId: Id<"subscriptions">;
  eventId: Id<"events">;
  matchScore: number;
  matchType: string;
  queuedAt: number;
  emailSent?: boolean;
  emailSentAt?: number;
  event: Doc<"events"> | null;
};

export type SubscriptionWithQueue = Doc<"subscriptions"> & {
  queuedEvents: QueuedEventItem[];
  totalQueuedEvents: number;
  nextEmailScheduled: number;
  emailFrequencyHours: number;
};

// Types for search results
export type EventSearchResult = Doc<"events"> & {
  _score?: number;
  score: number;
  matchType: "semantic" | "title";
  meetsThreshold?: boolean;
  thresholdValue?: number;
};

// Constants
export const SIMILARITY_THRESHOLD = 0.2; // Events below this score are excluded

// Validation utilities
export function validateSubscriptionData(data: {
  prompt?: string;
  emailFrequencyHours?: number;
}): void {
  if (data.prompt && data.prompt.trim().length === 0) {
    throw new Error("Subscription prompt cannot be empty");
  }

  if (data.emailFrequencyHours && data.emailFrequencyHours < 1) {
    throw new Error("Email frequency must be at least 1 hour");
  }
}

// Helper function to calculate cosine similarity
export function cosineSimilarity(a: number[], b: number[]): number {
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
