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

// Type definitions for subscription kinds
export type PromptSubscription = Doc<"subscriptions"> & {
  kind: "prompt";
  prompt: string;
  promptEmbedding?: number[];
};

export type AllEventsSubscription = Doc<"subscriptions"> & {
  kind: "all_events";
};

export type AnySubscription = PromptSubscription | AllEventsSubscription;

// Helper function to get isActive status
export function getIsActive(subscription: Doc<"subscriptions">): boolean {
  return subscription.isActive;
}

// Type guards for subscription kinds
export function isPromptSubscription(
  subscription: Doc<"subscriptions">,
): subscription is PromptSubscription {
  return (
    ("kind" in subscription && subscription.kind === "prompt") ||
    ("prompt" in subscription && subscription.prompt !== undefined)
  );
}

export function isAllEventsSubscription(
  subscription: Doc<"subscriptions">,
): subscription is AllEventsSubscription {
  return "kind" in subscription && subscription.kind === "all_events";
}

// Helper to get subscription kind (with backward compatibility)
export function getSubscriptionKind(
  subscription: Doc<"subscriptions">,
): "prompt" | "all_events" {
  if (isAllEventsSubscription(subscription)) {
    return "all_events";
  }
  if (isPromptSubscription(subscription)) {
    return "prompt";
  }
  // Default fallback
  return "prompt";
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
  kind?: "prompt" | "all_events";
  prompt?: string;
  emailFrequencyHours?: number;
}): void {
  if (
    data.kind === "prompt" &&
    (!data.prompt || data.prompt.trim().length === 0)
  ) {
    throw new Error("Prompt subscription requires a non-empty prompt");
  }

  if (data.emailFrequencyHours && data.emailFrequencyHours < 1) {
    throw new Error("Email frequency must be at least 1 hour");
  }
}

// Helper to create subscription data
export function createSubscriptionData(
  userId: Id<"users">,
  kind: "prompt",
  options: {
    prompt: string;
    isActive?: boolean;
    emailFrequencyHours?: number;
  },
): {
  kind: "prompt";
  userId: Id<"users">;
  prompt: string;
  isActive: boolean;
  emailFrequencyHours: number;
  lastEmailSent: number;
  nextEmailScheduled: number;
};
export function createSubscriptionData(
  userId: Id<"users">,
  kind: "all_events",
  options: {
    isActive?: boolean;
    emailFrequencyHours?: number;
  },
): {
  kind: "all_events";
  userId: Id<"users">;
  isActive: boolean;
  emailFrequencyHours: number;
  lastEmailSent: number;
  nextEmailScheduled: number;
};
export function createSubscriptionData(
  userId: Id<"users">,
  kind: "prompt" | "all_events",
  options: {
    prompt?: string;
    isActive?: boolean;
    emailFrequencyHours?: number;
  },
): {
  kind: "prompt" | "all_events";
  userId: Id<"users">;
  prompt?: string;
  isActive: boolean;
  emailFrequencyHours: number;
  lastEmailSent: number;
  nextEmailScheduled: number;
} {
  const baseData = {
    userId,
    kind,
    isActive: options.isActive ?? true,
    emailFrequencyHours: options.emailFrequencyHours || 24,
    lastEmailSent: 0, // Never sent
    nextEmailScheduled: Date.now(), // Can send immediately
  };

  if (kind === "prompt") {
    if (!options.prompt) {
      throw new Error("Prompt is required for prompt subscriptions");
    }
    return {
      ...baseData,
      prompt: options.prompt,
    };
  } else {
    return baseData;
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
