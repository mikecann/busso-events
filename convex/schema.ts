import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  events: defineTable({
    title: v.string(),
    description: v.string(),
    eventDate: v.number(), // Unix timestamp
    imageUrl: v.string(),
    url: v.string(),
    sourceId: v.optional(v.id("eventSources")),
    lastScraped: v.optional(v.number()),
    scrapedData: v.optional(
      v.object({
        originalEventDate: v.optional(v.string()),
        location: v.optional(v.string()),
        organizer: v.optional(v.string()),
        price: v.optional(v.string()),
        category: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        registrationUrl: v.optional(v.string()),
        contactInfo: v.optional(v.string()),
        additionalDetails: v.optional(v.string()),
      }),
    ),
    descriptionEmbedding: v.optional(v.array(v.number())),
    // Track scheduled subscription matching
    subscriptionMatchScheduledId: v.optional(v.id("_scheduled_functions")),
    subscriptionMatchScheduledAt: v.optional(v.number()),
    // Track workpool event scraping
    scrapeWorkId: v.optional(v.string()), // WorkId is stored as string
    scrapeEnqueuedAt: v.optional(v.number()),
    // Track workpool embedding generation
    embeddingWorkId: v.optional(v.string()),
    embeddingEnqueuedAt: v.optional(v.number()),
  })
    .index("by_event_date", ["eventDate"])
    .index("by_url", ["url"])
    .searchIndex("search_title", {
      searchField: "title",
    })
    .searchIndex("search_description", {
      searchField: "description",
    })
    .vectorIndex("by_embedding", {
      vectorField: "descriptionEmbedding",
      dimensions: 1536,
    }),

  eventSources: defineTable({
    name: v.string(),
    startingUrl: v.string(),
    isActive: v.boolean(),
    dateLastScrape: v.optional(v.number()),
    // Track scheduled scraping
    nextScrapeScheduledId: v.optional(v.id("_scheduled_functions")),
    nextScrapeScheduledAt: v.optional(v.number()),
  }),

  testScrapes: defineTable({
    url: v.string(),
    status: v.string(), // "pending", "running", "completed", "failed"
    progress: v.optional(
      v.object({
        stage: v.string(), // "fetching", "extracting", "processing"
        message: v.string(),
        eventsFound: v.optional(v.number()),
      }),
    ),
    result: v.optional(
      v.object({
        success: v.boolean(),
        message: v.string(),
        eventsFound: v.optional(v.number()),
        data: v.optional(v.any()),
      }),
    ),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_created", ["createdAt"]),

  subscriptions: defineTable(
    v.union(
      // Prompt-based subscription
      v.object({
        kind: v.literal("prompt"),
        userId: v.id("users"),
        prompt: v.string(),
        promptEmbedding: v.optional(v.array(v.number())),
        // Shared fields
        isActive: v.boolean(),
        lastEmailSent: v.optional(v.number()), // Timestamp of last email sent
        nextEmailScheduled: v.optional(v.number()), // Timestamp when next email should be sent
        emailFrequencyHours: v.optional(v.number()), // How often to send emails (default 24 hours)
        // Legacy field for migration
        status: v.optional(v.string()), // Keep old field for migration
      }),
      // All events subscription
      v.object({
        kind: v.literal("all_events"),
        userId: v.id("users"),
        // Shared fields
        isActive: v.boolean(),
        lastEmailSent: v.optional(v.number()), // Timestamp of last email sent
        nextEmailScheduled: v.optional(v.number()), // Timestamp when next email should be sent
        emailFrequencyHours: v.optional(v.number()), // How often to send emails (default 24 hours)
        // Legacy field for migration
        status: v.optional(v.string()), // Keep old field for migration
      }),
    ),
  )
    .index("by_user", ["userId"])
    .index("by_kind", ["kind"])
    .index("by_next_email", ["nextEmailScheduled"])
    .vectorIndex("by_prompt_embedding", {
      vectorField: "promptEmbedding",
      dimensions: 1536,
    }),

  // New table to queue events for email notifications
  emailQueue: defineTable({
    subscriptionId: v.id("subscriptions"),
    eventId: v.id("events"),
    matchScore: v.number(), // The similarity score when matched
    matchType: v.string(), // "semantic" or "title"
    queuedAt: v.number(), // When this was added to the queue
    emailSent: v.optional(v.boolean()), // Whether this has been sent in an email
    emailSentAt: v.optional(v.number()), // When the email was sent
  })
    .index("by_subscription", ["subscriptionId"])
    .index("by_subscription_unsent", ["subscriptionId", "emailSent"])
    .index("by_event", ["eventId"])
    .index("by_queued_at", ["queuedAt"]),

  jobs: defineTable({
    kind: v.union(
      v.literal("batch_event_scrape"),
      v.literal("batch_source_scrape"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    progress: v.object({
      totalEvents: v.optional(v.number()),
      totalSources: v.optional(v.number()),
      processedEvents: v.optional(v.number()),
      processedSources: v.optional(v.number()),
      successfulScrapes: v.optional(v.number()),
      failedScrapes: v.optional(v.number()),
      totalEventsFound: v.optional(v.number()),
      currentEvent: v.optional(v.union(v.string(), v.null())),
      currentSource: v.optional(v.union(v.string(), v.null())),
    }),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_status", ["status"]),

  // Extend the users table to include isAdmin field
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    isAdmin: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
