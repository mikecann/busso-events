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

// Email sending result types
export interface EmailSendResult {
  success: boolean;
  message: string;
  eventsSent?: number;
}

export interface EmailQueueStats {
  total: number;
  unsent: number;
  sent: number;
}

// Email content generation types
export interface EmailContent {
  subject: string;
  html: string;
  text?: string;
}

// Email template data
export interface EmailTemplateData {
  subscription: Doc<"subscriptions">;
  queuedEvents: QueuedEventItem[];
  user: Doc<"users">;
  totalEvents: number;
}

// Validation utilities
export function validateEmailData(data: {
  subscriptionId?: Id<"subscriptions">;
  eventIds?: Id<"events">[];
}): void {
  if (!data.subscriptionId) {
    throw new Error("Subscription ID is required");
  }

  if (data.eventIds && data.eventIds.length === 0) {
    throw new Error("Event IDs array cannot be empty");
  }
}

// Email formatting utilities
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} from now`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} from now`;
  } else {
    return "Today";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 0.8) return "#10b981"; // green
  if (score >= 0.6) return "#f59e0b"; // yellow
  if (score >= 0.4) return "#f97316"; // orange
  return "#ef4444"; // red
}

export function getScoreLabel(score: number): string {
  if (score >= 0.8) return "Excellent match";
  if (score >= 0.6) return "Good match";
  if (score >= 0.4) return "Fair match";
  return "Poor match";
}

// Email queue utilities
export function isEmailQueued(queueItem: QueuedEventItem): boolean {
  return !queueItem.emailSent;
}

export function isEmailSent(queueItem: QueuedEventItem): boolean {
  return queueItem.emailSent === true;
}

export function getQueuedEventsCount(queueItems: QueuedEventItem[]): number {
  return queueItems.filter(isEmailQueued).length;
}

export function getSentEventsCount(queueItems: QueuedEventItem[]): number {
  return queueItems.filter(isEmailSent).length;
}

// Email frequency utilities
export function calculateNextEmailTime(
  lastEmailSent: number,
  frequencyHours: number,
): number {
  return lastEmailSent + frequencyHours * 60 * 60 * 1000;
}

export function isEmailDue(
  lastEmailSent: number,
  frequencyHours: number,
): boolean {
  const nextEmailTime = calculateNextEmailTime(lastEmailSent, frequencyHours);
  return Date.now() >= nextEmailTime;
}

// Email content generation helpers
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/javascript:/gi, "");
}

// Email template constants
export const EMAIL_TEMPLATE_CONSTANTS = {
  MAX_EVENTS_PER_EMAIL: 10,
  MAX_DESCRIPTION_LENGTH: 200,
  DEFAULT_FROM_ADDRESS:
    "Busso Events Notifications <notifications@busso.events>",
  DEV_FROM_ADDRESS: "Busso Events Dev <onboarding@resend.dev>",
} as const;
