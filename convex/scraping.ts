"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import OpenAI from "openai";

const openai = new OpenAI({
  //baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export const scrapeUrl = action({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated to scrape URLs");
    }

    return await performScrape(args.url);
  },
});

// Internal version that doesn't require authentication
export const scrapeUrlInternal = internalAction({
  args: {
    url: v.string(),
  },
  handler: async (_ctx, args) => {
    return await performScrape(args.url);
  },
});

// New action for scraping individual event pages
export const scrapeEventPage = action({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be authenticated to scrape event pages");
    }

    return await performEventPageScrape(args.url);
  },
});

// Internal version for event page scraping
export const scrapeEventPageInternal = internalAction({
  args: {
    url: v.string(),
  },
  handler: async (_ctx, args) => {
    return await performEventPageScrape(args.url);
  },
});

async function performScrape(url: string) {
  try {
    console.log(`Starting scrape for URL: ${url}`);

    // Use Jina.ai reader API to get the content
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.JINA_API_KEY}`,
        "X-Return-Format": "markdown",
        "X-With-Images-Summary": "true",
        "X-With-Links-Summary": "true",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Jina API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const content = await response.text();

    console.log("=== JINA.AI SCRAPE RESULT ===");
    console.log(`URL: ${url}`);
    console.log(`Content length: ${content.length} characters`);
    console.log("Content preview (first 1000 chars):");
    console.log(content.substring(0, 1000));
    console.log("=== END SCRAPE RESULT ===");

    // Extract events using OpenAI
    console.log("=== EXTRACTING EVENTS WITH OPENAI ===");

    const extractionPrompt = `
You are an expert at extracting event information from web content. 

Analyze the following markdown content and extract a list of events. For each event, provide:
- title: The event name/title
- url: The URL that leads to more details about the event (this should be a full URL, not a relative path)
- eventDate: The date of the event if available (in YYYY-MM-DD format if possible, otherwise as found)
- imageUrl: The URL of an image associated with the event (if available). This could be an event poster, venue photo, or promotional image. Make sure it's a full URL.

Only extract actual events (conferences, meetups, workshops, concerts, etc.). Do not include:
- Navigation links
- General website pages
- Non-event content

Return the results as a JSON array of objects with the structure:
[
  {
    "title": "Event Title",
    "url": "https://example.com/event-details",
    "eventDate": "2024-03-15",
    "imageUrl": "https://example.com/event-image.jpg"
  }
]

If no events are found, return an empty array [].
If an event doesn't have an associated image, omit the imageUrl field or set it to null.

Here is the markdown content to analyze:

${content}
`;

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
      temperature: 0.1,
    });

    const extractedContent = openaiResponse.choices[0].message.content;
    console.log("OpenAI extraction result:", extractedContent);

    let extractedEvents = [];
    try {
      // Try to parse the JSON response
      const jsonMatch = extractedContent?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedEvents = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse OpenAI response as JSON:", parseError);
      console.log("Raw OpenAI response:", extractedContent);
    }

    console.log(`Extracted ${extractedEvents.length} events:`, extractedEvents);
    console.log("=== END EVENT EXTRACTION ===");

    return {
      success: true,
      message: "URL scraped successfully and events extracted",
      data: {
        url: url,
        contentLength: content.length,
        content: content,
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

async function performEventPageScrape(url: string) {
  try {
    console.log(`Starting event page scrape for URL: ${url}`);

    // Use Jina.ai reader API to get the content
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.JINA_API_KEY}`,
        "X-Return-Format": "markdown",
        "X-With-Images-Summary": "true",
        "X-With-Links-Summary": "true",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Jina API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const content = await response.text();

    console.log("=== JINA.AI EVENT PAGE SCRAPE RESULT ===");
    console.log(`URL: ${url}`);
    console.log(`Content length: ${content.length} characters`);
    console.log("Content preview (first 1000 chars):");
    console.log(content.substring(0, 1000));
    console.log("=== END EVENT PAGE SCRAPE RESULT ===");

    // Extract event details using OpenAI
    console.log("=== EXTRACTING EVENT DETAILS WITH OPENAI ===");

    const extractionPrompt = `
You are an expert at extracting detailed event information from web pages.

Analyze the following markdown content from an event page and extract comprehensive event details:

Extract the following information if available:
- title: The main event title/name
- description: A detailed description of the event (combine multiple paragraphs if needed)
- eventDate: The date and time of the event (in YYYY-MM-DD HH:MM format if possible, otherwise as found)
- location: The venue name and/or address where the event takes place
- organizer: Who is organizing the event
- price: Ticket price or cost information
- category: Type of event (conference, workshop, concert, etc.)
- tags: Relevant keywords or topics related to the event
- imageUrls: Array of image URLs found on the page (event posters, venue photos, etc.)
- registrationUrl: URL for registration or ticket purchase
- contactInfo: Contact information (email, phone, etc.)
- additionalDetails: Any other relevant information (dress code, what to bring, etc.)

Return the results as a JSON object with this structure:
{
  "title": "Event Title",
  "description": "Detailed event description...",
  "eventDate": "2024-03-15 19:00",
  "location": "Venue Name, Address",
  "organizer": "Organization Name",
  "price": "Free" or "$25" or "Starting at $50",
  "category": "conference",
  "tags": ["technology", "AI", "networking"],
  "imageUrls": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
  "registrationUrl": "https://example.com/register",
  "contactInfo": "contact@example.com or +1-555-0123",
  "additionalDetails": "Bring your laptop, business casual dress code"
}

If any field is not available, omit it or set it to null.
Focus on extracting accurate, relevant information about this specific event.

Here is the markdown content to analyze:

${content}
`;

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
      temperature: 0.1,
    });

    const extractedContent = openaiResponse.choices[0].message.content;
    console.log("OpenAI event details extraction result:", extractedContent);

    let eventDetails = {};
    try {
      // Try to parse the JSON response
      const jsonMatch = extractedContent?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        eventDetails = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse OpenAI response as JSON:", parseError);
      console.log("Raw OpenAI response:", extractedContent);
    }

    console.log("Extracted event details:", eventDetails);
    console.log("=== END EVENT DETAILS EXTRACTION ===");

    return {
      success: true,
      message: "Event page scraped successfully and details extracted",
      data: {
        url: url,
        contentLength: content.length,
        content: content,
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
