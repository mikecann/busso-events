import { convexTest } from "convex-test";
import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import {
  ScrapeResult,
  EventPageScrapeResult,
  ExtractedEvent,
  ExtractedEventDetails,
} from "./common";

// Mock OpenAI at the module level
const mockOpenAICreate = vi.fn();
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockOpenAICreate,
        },
      },
    })),
  };
});

// Mock data for testing
const MOCK_JINA_CONTENT = `
# Events This Week

## Tech Conference 2024
A comprehensive conference about the latest in technology and innovation.
Date: March 15, 2024
Location: Tech Center Downtown
[Learn More](https://example.com/tech-conference)

## AI Workshop
Hands-on workshop covering machine learning and AI fundamentals.
Date: March 20, 2024
Location: Innovation Hub
[Register](https://example.com/ai-workshop)

## Startup Pitch Night
Local entrepreneurs present their ideas to investors.
Date: March 25, 2024
Location: Business Incubator
[Details](https://example.com/pitch-night)
`;

const MOCK_EVENT_PAGE_CONTENT = `
# Tech Conference 2024

## About This Event
Join us for the most comprehensive technology conference of the year. This three-day event brings together industry leaders, innovative startups, and technology enthusiasts.

**Date:** March 15-17, 2024
**Time:** 9:00 AM - 6:00 PM daily
**Location:** Tech Center Downtown, 123 Innovation Drive, Tech City
**Organizer:** Tech Events Inc.
**Price:** Early bird $299, Regular $399

### What You'll Learn
- Latest trends in AI and machine learning
- Cloud computing best practices
- Cybersecurity fundamentals
- Startup success stories

### Speakers Include
- Jane Smith, CTO at TechCorp
- John Doe, AI Researcher at InnovateLab

**Registration:** [Register Now](https://example.com/register)
**Contact:** info@techconference.com | (555) 123-4567

![Conference Banner](https://example.com/banner.jpg)
![Venue Photo](https://example.com/venue.jpg)
`;

const MOCK_EXTRACTED_EVENTS: ExtractedEvent[] = [
  {
    title: "Tech Conference 2024",
    description:
      "A comprehensive conference about the latest in technology and innovation.",
    url: "https://example.com/tech-conference",
    eventDate: "2024-03-15",
    imageUrl: "https://example.com/tech-conf-banner.jpg",
  },
  {
    title: "AI Workshop",
    description:
      "Hands-on workshop covering machine learning and AI fundamentals.",
    url: "https://example.com/ai-workshop",
    eventDate: "2024-03-20",
  },
  {
    title: "Startup Pitch Night",
    description: "Local entrepreneurs present their ideas to investors.",
    url: "https://example.com/pitch-night",
    eventDate: "2024-03-25",
  },
];

const MOCK_EVENT_DETAILS: ExtractedEventDetails = {
  title: "Tech Conference 2024",
  description:
    "Join us for the most comprehensive technology conference of the year. This three-day event brings together industry leaders, innovative startups, and technology enthusiasts.",
  eventDate: "2024-03-15 09:00",
  location: "Tech Center Downtown, 123 Innovation Drive, Tech City",
  organizer: "Tech Events Inc.",
  price: "Early bird $299, Regular $399",
  category: "conference",
  tags: ["technology", "AI", "cloud computing", "cybersecurity"],
  imageUrls: [
    "https://example.com/banner.jpg",
    "https://example.com/venue.jpg",
  ],
  registrationUrl: "https://example.com/register",
  contactInfo: "info@techconference.com | (555) 123-4567",
};

// Helper functions for creating mock responses
function createSuccessfulFetchResponse(text: string): Response {
  return new Response(text, {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "text/plain" },
  });
}

function createFailedFetchResponse(
  status: number,
  statusText: string,
): Response {
  return new Response("Error", {
    status,
    statusText,
    headers: { "Content-Type": "text/plain" },
  });
}

function createSuccessfulOpenAIResponse(content: any) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(content),
        },
      },
    ],
  };
}

describe("Source URL Scraping", () => {
  let mockFetch: any;

  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv("JINA_API_KEY", "test-jina-key");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");

    // Mock fetch for Jina API
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    // Reset OpenAI mock
    mockOpenAICreate.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test("should extract multiple events when scraping a valid source URL with event listings", async () => {
    const t = convexTest(schema);

    // Setup successful mocks
    mockFetch.mockResolvedValue(
      createSuccessfulFetchResponse(MOCK_JINA_CONTENT),
    );
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(MOCK_EXTRACTED_EVENTS),
          },
        },
      ],
    });

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: "https://example.com/events",
      },
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe(
      "URL scraped successfully and events extracted",
    );
    expect(result.data).not.toBeNull();
    expect(result.data!.extractedEvents).toHaveLength(3);
    expect(result.data!.extractedEvents[0]).toMatchObject({
      title: "Tech Conference 2024",
      description:
        "A comprehensive conference about the latest in technology and innovation.",
      url: "https://example.com/tech-conference",
      eventDate: "2024-03-15",
    });
  });

  test("should return empty event list when source URL contains no events", async () => {
    const t = convexTest(schema);

    // Setup mocks for content with no events
    mockFetch.mockResolvedValue(
      createSuccessfulFetchResponse("No events found on this page."),
    );
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([]),
          },
        },
      ],
    });

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: "https://example.com/no-events",
      },
    );

    expect(result.success).toBe(true);
    expect(result.data!.extractedEvents).toHaveLength(0);
  });

  test("should fail gracefully when provided with an invalid URL", async () => {
    const t = convexTest(schema);

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: "not-a-valid-url",
      },
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid URL");
    expect(result.data).toBeNull();
  });

  test("should handle Jina API failures gracefully and return error result", async () => {
    const t = convexTest(schema);

    // Setup failed Jina API response
    mockFetch.mockResolvedValue(
      createFailedFetchResponse(500, "Internal Server Error"),
    );

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: "https://example.com/events",
      },
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Jina API request failed");
    expect(result.data).toBeNull();
  });

  test("should handle OpenAI extraction failures gracefully", async () => {
    const t = convexTest(schema);

    // Setup successful Jina but failed OpenAI
    mockFetch.mockResolvedValue(
      createSuccessfulFetchResponse(MOCK_JINA_CONTENT),
    );
    mockOpenAICreate.mockRejectedValue(new Error("OpenAI API Error"));

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: "https://example.com/events",
      },
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("OpenAI API Error");
    expect(result.data).toBeNull();
  });

  test("should handle malformed JSON from OpenAI gracefully", async () => {
    const t = convexTest(schema);

    // Setup successful Jina but malformed OpenAI response
    mockFetch.mockResolvedValue(
      createSuccessfulFetchResponse(MOCK_JINA_CONTENT),
    );
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: "This is not valid JSON",
          },
        },
      ],
    });

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: "https://example.com/events",
      },
    );

    expect(result.success).toBe(true);
    expect(result.data!.extractedEvents).toHaveLength(0);
  });

  test("should handle missing JINA_API_KEY environment variable", async () => {
    const t = convexTest(schema);

    // Remove the API key
    vi.stubEnv("JINA_API_KEY", "");

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: "https://example.com/events",
      },
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain(
      "JINA_API_KEY environment variable is required",
    );
    expect(result.data).toBeNull();
  });

  test("should sanitize content that exceeds maximum length limits", async () => {
    const t = convexTest(schema);

    // Create very long content
    const longContent = "a".repeat(150000); // Exceeds 100KB limit
    mockFetch.mockResolvedValue(createSuccessfulFetchResponse(longContent));
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([]),
          },
        },
      ],
    });

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeUrlInternal,
      {
        url: "https://example.com/events",
      },
    );

    expect(result.success).toBe(true);
    expect(result.data!.content.length).toBeLessThanOrEqual(100003); // 100KB + "..."
    expect(result.data!.content).toMatch(/\.\.\.$/); // Check if content ends with "..."
  });
});

describe("Individual Event Page Scraping", () => {
  let mockFetch: any;

  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv("JINA_API_KEY", "test-jina-key");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");

    // Mock fetch for Jina API
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    // Reset OpenAI mock
    mockOpenAICreate.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test("should extract comprehensive event details when scraping a valid event page", async () => {
    const t = convexTest(schema);

    // Setup successful mocks
    mockFetch.mockResolvedValue(
      createSuccessfulFetchResponse(MOCK_EVENT_PAGE_CONTENT),
    );
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(MOCK_EVENT_DETAILS),
          },
        },
      ],
    });

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeEventPageInternal,
      {
        url: "https://example.com/tech-conference",
      },
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe(
      "Event page scraped successfully and details extracted",
    );
    expect(result.data).not.toBeNull();
    expect(result.data!.eventDetails).toMatchObject({
      title: "Tech Conference 2024",
      description: expect.stringContaining(
        "comprehensive technology conference",
      ),
      eventDate: "2024-03-15 09:00",
      location: "Tech Center Downtown, 123 Innovation Drive, Tech City",
      organizer: "Tech Events Inc.",
      price: "Early bird $299, Regular $399",
    });
  });

  test("should handle missing optional event details gracefully", async () => {
    const t = convexTest(schema);

    const minimalEventDetails = {
      title: "Simple Event",
      description: "A simple event with minimal details",
    };

    mockFetch.mockResolvedValue(
      createSuccessfulFetchResponse("Simple event page"),
    );
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(minimalEventDetails),
          },
        },
      ],
    });

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeEventPageInternal,
      {
        url: "https://example.com/simple-event",
      },
    );

    expect(result.success).toBe(true);
    expect(result.data!.eventDetails).toMatchObject(minimalEventDetails);
    expect(result.data!.eventDetails.location).toBeUndefined();
    expect(result.data!.eventDetails.price).toBeUndefined();
  });

  test("should fail gracefully when provided with an invalid event URL", async () => {
    const t = convexTest(schema);

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeEventPageInternal,
      {
        url: "invalid-url",
      },
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid URL");
    expect(result.data).toBeNull();
  });

  test("should handle API failures for event page scraping gracefully", async () => {
    const t = convexTest(schema);

    // Setup failed Jina API response
    mockFetch.mockResolvedValue(createFailedFetchResponse(404, "Not Found"));

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeEventPageInternal,
      {
        url: "https://example.com/nonexistent-event",
      },
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Jina API request failed");
    expect(result.data).toBeNull();
  });

  test("should handle malformed JSON from OpenAI event details extraction", async () => {
    const t = convexTest(schema);

    // Setup successful Jina but malformed OpenAI response
    mockFetch.mockResolvedValue(
      createSuccessfulFetchResponse(MOCK_EVENT_PAGE_CONTENT),
    );
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: "Not valid JSON at all",
          },
        },
      ],
    });

    const result = await t.action(
      internal.scraping.scrapingInternal.scrapeEventPageInternal,
      {
        url: "https://example.com/tech-conference",
      },
    );

    expect(result.success).toBe(true);
    expect(result.data!.eventDetails).toEqual({});
  });
});
