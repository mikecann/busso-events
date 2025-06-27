import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Authentication helper
export async function requireAuth(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be authenticated");
  }
  return userId;
}

// Event source data types
export interface EventSourceData {
  name: string;
  startingUrl: string;
  isActive?: boolean;
}

export interface EventSourceUpdateData {
  name?: string;
  startingUrl?: string;
  isActive?: boolean;
}

// Scraping result types
export interface SourceScrapeResult {
  success: boolean;
  message: string;
  eventsFound?: number;
  data?: {
    sourceName: string;
    sourceUrl: string;
    totalEventsFound: number;
    newEventsCreated: number;
    existingEventsSkipped: number;
  };
}

export interface TestScrapeResult {
  success: boolean;
  message: string;
  eventsFound?: number;
  data?: {
    url: string;
    totalEventsFound: number;
    scrapedData?: unknown;
    extractedEvents?: unknown[];
  };
}

// Test scrape progress types
export interface TestScrapeProgress {
  stage: string;
  message: string;
  eventsFound?: number;
}

// Source status types
export interface SourceStatus {
  totalSources: number;
  activeSources: number;
  sourcesNeedingScraping: number;
  recentlyScraped: Array<{
    id: Id<"eventSources">;
    name: string;
    lastScraped: number | undefined;
  }>;
  nextScrapingCandidates: Array<{
    id: Id<"eventSources">;
    name: string;
    lastScraped: number | undefined;
    daysSinceLastScrape: number | null;
  }>;
}

// Event source statistics
export interface EventSourceStats {
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  oldestEvent: number | null;
  newestEvent: number | null;
}

// Validation utilities
export function validateEventSourceData(data: Partial<EventSourceData>): void {
  if (data.name && data.name.trim().length === 0) {
    throw new Error("Event source name cannot be empty");
  }

  if (data.startingUrl && !isValidUrl(data.startingUrl)) {
    throw new Error("Starting URL must be a valid URL");
  }
}

export function validateEventSourceUpdateData(
  data: Partial<EventSourceUpdateData>,
): void {
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new Error("Event source name cannot be empty");
  }

  if (data.startingUrl !== undefined && !isValidUrl(data.startingUrl)) {
    throw new Error("Starting URL must be a valid URL");
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Scheduling utilities
export function calculateNextScrapeTime(lastScrapeTime?: number): number {
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 days
  const baseTime = lastScrapeTime || Date.now();
  return baseTime + threeDaysInMs;
}

export function getInitialScrapeDelay(): number {
  return 5 * 60 * 1000; // 5 minutes for new sources
}

export function isDueForScraping(
  lastScrapeTime: number | undefined,
  thresholdHours: number = 24,
): boolean {
  if (!lastScrapeTime) return true;

  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  return Date.now() - lastScrapeTime > thresholdMs;
}

// Source filtering utilities
export function filterActiveSources(
  sources: Doc<"eventSources">[],
): Doc<"eventSources">[] {
  return sources.filter((source) => source.isActive);
}

export function filterSourcesNeedingScraping(
  sources: Doc<"eventSources">[],
  thresholdHours: number = 24,
): Doc<"eventSources">[] {
  return sources.filter(
    (source) =>
      source.isActive &&
      isDueForScraping(source.dateLastScrape, thresholdHours),
  );
}

export function sortSourcesByLastScrape(
  sources: Doc<"eventSources">[],
): Doc<"eventSources">[] {
  return sources.sort(
    (a, b) => (b.dateLastScrape || 0) - (a.dateLastScrape || 0),
  );
}

// URL and data processing utilities
export function sanitizeSourceName(name: string): string {
  return name.trim().substring(0, 100); // Limit length and trim whitespace
}

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove trailing slash and ensure consistent format
    return urlObj.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

// Error handling utilities
export function createSourceError(
  sourceId: Id<"eventSources">,
  message: string,
): Error {
  return new Error(`Event source '${sourceId}': ${message}`);
}

export function formatScrapeError(
  sourceId: Id<"eventSources">,
  error: unknown,
): string {
  const baseMessage = `Failed to scrape source '${sourceId}'`;
  if (error instanceof Error) {
    return `${baseMessage}: ${error.message}`;
  }
  return `${baseMessage}: Unknown error`;
}

// Constants
export const SOURCE_CONSTANTS = {
  DEFAULT_SCRAPE_INTERVAL_DAYS: 3,
  INITIAL_SCRAPE_DELAY_MINUTES: 5,
  MAX_SOURCE_NAME_LENGTH: 100,
  MAX_URL_LENGTH: 2000,
  SCRAPING_THRESHOLD_HOURS: 24,
} as const;
