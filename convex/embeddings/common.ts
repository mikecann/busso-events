import { Doc, Id } from "../_generated/dataModel";

// Types for embedding operations
export interface EmbeddingResult {
  success: boolean;
  message?: string;
}

export interface BatchEmbeddingResult {
  success: boolean;
  processed: number;
  failed: number;
  total: number;
  failedEvents?: Id<"events">[];
}

export interface EmbeddingGenerationStats {
  totalEvents: number;
  eventsWithEmbeddings: number;
  eventsWithoutEmbeddings: number;
  subscriptionsWithEmbeddings: number;
  subscriptionsWithoutEmbeddings: number;
}

// Embedding configuration constants
export const EMBEDDING_CONSTANTS = {
  OPENAI_MODEL: "text-embedding-3-small",
  MAX_TEXT_LENGTH: 8000, // Max characters for embedding input
  BATCH_SIZE: 10, // Number of embeddings to process in parallel
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// Utility functions
export function validateEmbeddingText(text: string): void {
  if (!text || text.trim().length === 0) {
    throw new Error("Text for embedding cannot be empty");
  }

  if (text.length > EMBEDDING_CONSTANTS.MAX_TEXT_LENGTH) {
    throw new Error(
      `Text too long for embedding: ${text.length} characters (max: ${EMBEDDING_CONSTANTS.MAX_TEXT_LENGTH})`,
    );
  }
}

export function truncateTextForEmbedding(text: string): string {
  if (text.length <= EMBEDDING_CONSTANTS.MAX_TEXT_LENGTH) {
    return text;
  }

  // Truncate and add ellipsis
  return text.substring(0, EMBEDDING_CONSTANTS.MAX_TEXT_LENGTH - 3) + "...";
}

export function prepareEventTextForEmbedding(event: Doc<"events">): string {
  // Combine title and description for better embedding quality
  const combinedText = `${event.title}\n\n${event.description}`;
  return truncateTextForEmbedding(combinedText);
}

export function prepareSubscriptionTextForEmbedding(prompt: string): string {
  return truncateTextForEmbedding(prompt);
}

// Validation functions
export function validateEmbeddingArray(embedding: number[]): void {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array");
  }

  if (embedding.length === 0) {
    throw new Error("Embedding array cannot be empty");
  }

  if (!embedding.every((num) => typeof num === "number" && !isNaN(num))) {
    throw new Error("Embedding array must contain only valid numbers");
  }
}

export function isValidEmbedding(embedding: any): embedding is number[] {
  try {
    validateEmbeddingArray(embedding);
    return true;
  } catch {
    return false;
  }
}

// Error handling utilities
export function formatEmbeddingError(
  operation: string,
  error: unknown,
): string {
  const baseMessage = `Failed to ${operation}`;

  if (error instanceof Error) {
    return `${baseMessage}: ${error.message}`;
  }

  return `${baseMessage}: Unknown error`;
}

export function shouldRetryEmbeddingError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Retry on rate limiting or temporary API issues
    if (
      message.includes("rate limit") ||
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("503") ||
      message.includes("502")
    ) {
      return true;
    }
  }

  return false;
}

// Batch processing utilities
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Progress tracking utilities
export interface EmbeddingProgress {
  total: number;
  processed: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  message: string;
}

export function createEmbeddingProgress(
  total: number,
  processed: number = 0,
  failed: number = 0,
  currentBatch: number = 0,
  totalBatches: number = 0,
  message: string = "Processing embeddings...",
): EmbeddingProgress {
  return {
    total,
    processed,
    failed,
    currentBatch,
    totalBatches,
    message,
  };
}
