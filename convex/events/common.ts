import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";

// Common types
export interface EventData {
  title: string;
  description: string;
  eventDate: number;
  imageUrl: string;
  url: string;
  sourceId?: string;
}

export interface ScrapedEventData {
  originalEventDate?: string;
  location?: string;
  organizer?: string;
  price?: string;
  category?: string;
  tags?: string[];
  registrationUrl?: string;
  contactInfo?: string;
  additionalDetails?: string;
}

export interface EventScrapeResult {
  success: boolean;
  message: string;
  scrapedData?: any;
}

// Admin authentication helper - can be used in both queries and mutations
export async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be authenticated");
  }

  const isAdmin = await ctx.runQuery(
    internal.events.eventsInternal.checkUserIsAdmin,
    {
      userId,
    },
  );

  if (!isAdmin) {
    throw new Error("Admin access required");
  }

  return userId;
}

// Admin authentication helper for actions (can't use runQuery)
export async function requireAdminAction(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be authenticated");
  }

  // Use internal query to check admin status
  const isAdmin = await ctx.runQuery(
    internal.events.eventsInternal.checkUserIsAdmin,
    {
      userId,
    },
  );
  if (!isAdmin) {
    throw new Error("Admin access required");
  }
  return userId;
}

// Date filter utilities
export function calculateMaxDateFromFilter(
  dateFilter?: "all" | "week" | "month" | "3months",
): number | undefined {
  if (!dateFilter || dateFilter === "all") {
    return undefined;
  }

  const now = Date.now();
  switch (dateFilter) {
    case "week":
      return now + 7 * 24 * 60 * 60 * 1000; // 1 week
    case "month":
      return now + 30 * 24 * 60 * 60 * 1000; // 30 days
    case "3months":
      return now + 90 * 24 * 60 * 60 * 1000; // 90 days
    default:
      return undefined;
  }
}

// Event filtering utilities
export function isEventUpcoming(eventDate: number): boolean {
  return eventDate > Date.now();
}

export function isEventInDateRange(
  eventDate: number,
  maxDate?: number,
): boolean {
  if (!maxDate) return true;
  return eventDate <= maxDate;
}

// Filter events by date criteria
export function filterEventsByDate(
  events: any[],
  dateFilter?: "all" | "week" | "month" | "3months",
): any[] {
  const maxDate = calculateMaxDateFromFilter(dateFilter);

  return events.filter((event) => {
    // Only show future events
    if (!isEventUpcoming(event.eventDate)) return false;
    // Apply date filter if specified
    if (!isEventInDateRange(event.eventDate, maxDate)) return false;
    return true;
  });
}

// Deduplication utility for search results
export function deduplicateEvents(events: any[]): any[] {
  return events.filter(
    (event, index, self) =>
      index === self.findIndex((e) => e._id === event._id),
  );
}

// Sort events by date (ascending - soonest first)
export function sortEventsByDate(events: any[]): any[] {
  return events.sort((a, b) => a.eventDate - b.eventDate);
}

// Convert scraped event details to the scrapedData format
export function convertEventDetailsToScrapedData(
  eventDetails: any,
  fallbackUrl: string,
): ScrapedEventData {
  return {
    location: eventDetails.location || undefined,
    organizer: eventDetails.organizer || undefined,
    price: eventDetails.price || undefined,
    category: eventDetails.category || undefined,
    tags: eventDetails.tags || [],
    registrationUrl: eventDetails.registrationUrl || fallbackUrl,
    contactInfo: eventDetails.contactInfo || undefined,
    additionalDetails: eventDetails.additionalDetails || undefined,
    originalEventDate: eventDetails.eventDate || undefined,
  };
}

// Image URL processing utilities
export function filterImageUrls(imageUrls: string[]): string[] {
  return imageUrls.filter((url: string) => {
    // Skip URLs that are likely page URLs rather than images
    if (url.includes("/event/") || url.includes("/events/")) return false;
    // Only include URLs that look like image files
    return (
      /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) || url.includes("media.")
    );
  });
}

export function selectBestImageUrl(imageUrls: string[]): string | undefined {
  const filteredUrls = filterImageUrls(imageUrls);

  if (filteredUrls.length === 0) return undefined;

  // Prefer larger images by looking for size indicators in the URL
  const sortedImages = filteredUrls.sort((a: string, b: string) => {
    // Extract width from transformation parameters (e.g., tr=w-3240,h-1920)
    const getWidth = (url: string) => {
      const match = url.match(/tr=w-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    };

    const aWidth = getWidth(a);
    const bWidth = getWidth(b);

    // If both have width info, prefer larger
    if (aWidth && bWidth) return bWidth - aWidth;

    // If only one has width info, prefer that one
    if (aWidth) return -1;
    if (bWidth) return 1;

    // Otherwise prefer URLs without size restrictions (likely original)
    if (a.includes("scaled") && !b.includes("scaled")) return 1;
    if (!a.includes("scaled") && b.includes("scaled")) return -1;

    return 0;
  });

  return sortedImages[0];
}

// Validation utilities
export function validateEventData(data: Partial<EventData>): void {
  if (data.title && data.title.trim().length === 0) {
    throw new Error("Event title cannot be empty");
  }

  if (data.url && !isValidUrl(data.url)) {
    throw new Error("Invalid event URL");
  }

  if (data.eventDate && data.eventDate < Date.now()) {
    throw new Error("Event date cannot be in the past");
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
