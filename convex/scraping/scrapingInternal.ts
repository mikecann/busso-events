import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";
import { internal } from "../_generated/api";
import {
  ScrapeResult,
  EventPageScrapeResult,
  ExtractedEvent,
  ExtractedEventDetails,
  SCRAPING_CONSTANTS,
  SCRAPING_PROMPTS,
  validateUrl,
  sanitizeContent,
  parseJsonFromResponse,
  createJinaUrl,
  getJinaHeaders,
} from "./common";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 0,
  timeout: 30_000,
});

// INTERNAL ACTIONS

export const scrapeUrlInternal = internalAction({
  args: {
    url: v.string(),
    pool: v.optional(v.literal("public")),
    // Only for scheduled source runs that reserved in reserveScheduledSourceScrape.
    reserved: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ScrapeResult> => {
    try {
      validateUrl(args.url);
      if (args.url.length > 2048) throw new Error("URL is too long");
    } catch (error) {
      return {
        success: false,
        message: `Failed to scrape URL: ${error instanceof Error ? error.message : "Invalid URL"}`,
        data: null,
      };
    }
    if (!args.reserved)
      await ctx.runMutation(internal.abuse.reservePaid, {
        operation: "scrape",
        pool: args.pool,
      });
    return await performScrape(args.url);
  },
});

export const scrapeEventPageInternal = internalAction({
  args: {
    url: v.string(),
    pool: v.optional(v.literal("public")),
    // Only for event scrape jobs that reserved in reserveEventJob.
    reserved: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<EventPageScrapeResult> => {
    try {
      validateUrl(args.url);
      if (args.url.length > 2048) throw new Error("URL is too long");
    } catch (error) {
      return {
        success: false,
        message: `Failed to scrape URL: ${error instanceof Error ? error.message : "Invalid URL"}`,
        data: null,
      };
    }
    if (!args.reserved)
      await ctx.runMutation(internal.abuse.reservePaid, {
        operation: "scrape",
        pool: args.pool,
      });
    return await performEventPageScrape(args.url);
  },
});

// INTERNAL HELPER FUNCTIONS

async function performScrape(url: string): Promise<ScrapeResult> {
  try {
    console.log(`Starting scrape for URL: ${url}`);

    // Validate URL
    validateUrl(url);

    // Check for required environment variables
    if (!process.env.JINA_API_KEY) {
      throw new Error("JINA_API_KEY environment variable is required");
    }

    // Use Jina.ai reader API to get the content
    const jinaUrl = createJinaUrl(url);
    const headers = getJinaHeaders(process.env.JINA_API_KEY);

    const response = await fetch(jinaUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(SCRAPING_CONSTANTS.TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Jina API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const content = await readBoundedContent(response);
    const sanitizedContent = sanitizeContent(content);

    console.log("=== JINA.AI SCRAPE RESULT ===");
    console.log(`URL: ${url}`);
    console.log(`Content length: ${sanitizedContent.length} characters`);
    console.log("Content preview (first 1000 chars):");
    console.log(sanitizedContent.substring(0, 1000));
    console.log("=== END SCRAPE RESULT ===");

    // Extract events using OpenAI
    console.log("=== EXTRACTING EVENTS WITH OPENAI ===");

    const extractionPrompt =
      SCRAPING_PROMPTS.EVENT_LIST_EXTRACTION(sanitizedContent);

    const openaiResponse = await openai.chat.completions.create({
      model: SCRAPING_CONSTANTS.OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
      temperature: SCRAPING_CONSTANTS.OPENAI_TEMPERATURE,
      max_tokens: 4096,
    });

    const extractedContent = openaiResponse.choices[0].message.content;
    console.log("OpenAI extraction result:", extractedContent);

    let extractedEvents: ExtractedEvent[] = [];
    if (extractedContent) {
      const parsedEvents = parseJsonFromResponse(extractedContent);
      if (Array.isArray(parsedEvents)) {
        extractedEvents = parsedEvents.slice(0, 30);
      }
    }

    console.log(`Extracted ${extractedEvents.length} events:`, extractedEvents);
    console.log("=== END EVENT EXTRACTION ===");

    return {
      success: true,
      message: "URL scraped successfully and events extracted",
      data: {
        url: url,
        contentLength: sanitizedContent.length,
        content: sanitizedContent,
        extractedEvents: extractedEvents,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    console.error("Error scraping URL:", error);
    return {
      success: false,
      message: `Failed to scrape URL: ${error instanceof Error ? error.message : "Unknown error"}`,
      data: null,
    };
  }
}

async function performEventPageScrape(
  url: string,
): Promise<EventPageScrapeResult> {
  try {
    console.log(`Starting event page scrape for URL: ${url}`);

    // Validate URL
    validateUrl(url);

    // Check for required environment variables
    if (!process.env.JINA_API_KEY) {
      throw new Error("JINA_API_KEY environment variable is required");
    }

    // Use Jina.ai reader API to get the content
    const jinaUrl = createJinaUrl(url);
    const headers = getJinaHeaders(process.env.JINA_API_KEY);

    const response = await fetch(jinaUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(SCRAPING_CONSTANTS.TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Jina API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const content = await readBoundedContent(response);
    const sanitizedContent = sanitizeContent(content);

    console.log("=== JINA.AI EVENT PAGE SCRAPE RESULT ===");
    console.log(`URL: ${url}`);
    console.log(`Content length: ${sanitizedContent.length} characters`);
    console.log("Content preview (first 1000 chars):");
    console.log(sanitizedContent.substring(0, 1000));
    console.log("=== END EVENT PAGE SCRAPE RESULT ===");

    // Extract event details using OpenAI
    console.log("=== EXTRACTING EVENT DETAILS WITH OPENAI ===");

    const extractionPrompt =
      SCRAPING_PROMPTS.EVENT_DETAILS_EXTRACTION(sanitizedContent);

    const openaiResponse = await openai.chat.completions.create({
      model: SCRAPING_CONSTANTS.OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
      temperature: SCRAPING_CONSTANTS.OPENAI_TEMPERATURE,
      max_tokens: 4096,
    });

    const extractedContent = openaiResponse.choices[0].message.content;
    console.log("OpenAI event details extraction result:", extractedContent);

    let eventDetails: ExtractedEventDetails = {};
    if (extractedContent) {
      const parsedDetails = parseJsonFromResponse(extractedContent);
      if (parsedDetails && typeof parsedDetails === "object") {
        eventDetails = parsedDetails;
      }
    }

    console.log("Extracted event details:", eventDetails);
    console.log("=== END EVENT DETAILS EXTRACTION ===");

    return {
      success: true,
      message: "Event page scraped successfully and details extracted",
      data: {
        url: url,
        contentLength: sanitizedContent.length,
        content: sanitizedContent,
        eventDetails: eventDetails,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    console.error("Error scraping event page:", error);
    return {
      success: false,
      message: `Failed to scrape event page: ${error instanceof Error ? error.message : "Unknown error"}`,
      data: null,
    };
  }
}

// Bound the downloaded response before buffering it or sending it to OpenAI.
async function readBoundedContent(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024 * 1024)
        throw new Error("Scraped response is too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
