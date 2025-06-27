// Shared types and utilities for scraping functionality

// Types for scraping results
export interface ScrapeResult {
  success: boolean;
  message: string;
  data: ScrapeData | null;
}

export interface ScrapeData {
  url: string;
  contentLength: number;
  content: string;
  extractedEvents: ExtractedEvent[];
  timestamp: number;
}

export interface EventPageScrapeResult {
  success: boolean;
  message: string;
  data: EventPageScrapeData | null;
}

export interface EventPageScrapeData {
  url: string;
  contentLength: number;
  content: string;
  eventDetails: ExtractedEventDetails;
  timestamp: number;
}

export interface ExtractedEvent {
  title: string;
  description: string;
  url?: string;
  eventDate?: string;
  imageUrl?: string;
}

export interface ExtractedEventDetails {
  title?: string;
  description?: string;
  eventDate?: string;
  location?: string;
  organizer?: string;
  price?: string;
  category?: string;
  tags?: string[];
  imageUrls?: string[];
  registrationUrl?: string;
  contactInfo?: string;
  additionalDetails?: string;
}

// Scraping configuration constants
export const SCRAPING_CONSTANTS = {
  JINA_BASE_URL: "https://r.jina.ai/",
  DEFAULT_HEADERS: {
    "X-Return-Format": "markdown",
    "X-With-Images-Summary": "true",
    "X-With-Links-Summary": "true",
  },
  OPENAI_MODEL: "gpt-4.1-nano",
  OPENAI_TEMPERATURE: 0.1,
  MAX_CONTENT_LENGTH: 100000, // 100KB limit for content
  TIMEOUT_MS: 30000, // 30 second timeout
} as const;

// Scraping prompt templates
export const SCRAPING_PROMPTS = {
  EVENT_LIST_EXTRACTION: (content: string) => `
You are an expert at extracting event information from web content. 

Analyze the following markdown content and extract a list of events. For each event, provide:
- title: The event name/title
- description: A brief description of the event (1-3 sentences summarizing what the event is about)
- url: The URL that leads to more details about the event (this should be a full URL, not a relative path)
- eventDate: The date of the event if available (prefer YYYY-MM-DD format, but any parseable date format is acceptable)
- imageUrl: The URL of an image associated with the event (if available). This could be an event poster, venue photo, or promotional image. Make sure it's a full URL.

Only extract actual events (conferences, meetups, workshops, concerts, etc.). Do not include:
- Navigation links
- General website pages
- Non-event content

Return the results as a JSON array of objects with the structure:
[
  {
    "title": "Event Title",
    "description": "Brief description of what this event is about and who should attend.",
    "url": "https://example.com/event-details",
    "eventDate": "2024-03-15",
    "imageUrl": "https://example.com/event-image.jpg"
  }
]

If no events are found, return an empty array [].
If an event doesn't have an associated image, omit the imageUrl field or set it to null.
If you can't find a specific description for an event, provide a brief generic description based on the title and context.

Here is the markdown content to analyze:

${content}
`,

  EVENT_DETAILS_EXTRACTION: (content: string) => `
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
`,
} as const;

// Utility functions
export function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

export function sanitizeContent(content: string): string {
  // Truncate content if it's too long
  if (content.length > SCRAPING_CONSTANTS.MAX_CONTENT_LENGTH) {
    return content.substring(0, SCRAPING_CONSTANTS.MAX_CONTENT_LENGTH) + "...";
  }
  return content;
}

export function parseJsonFromResponse(response: string): any {
  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error("Failed to parse JSON from response:", error);
    return null;
  }
}

export function createJinaUrl(targetUrl: string): string {
  return `${SCRAPING_CONSTANTS.JINA_BASE_URL}${targetUrl}`;
}

export function getJinaHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...SCRAPING_CONSTANTS.DEFAULT_HEADERS,
  };
}

// Validation functions
export function validateScrapeResult(result: any): result is ScrapeResult {
  return (
    typeof result === "object" &&
    result !== null &&
    typeof result.success === "boolean" &&
    typeof result.message === "string" &&
    (result.data === null || typeof result.data === "object")
  );
}

export function validateEventPageScrapeResult(
  result: any,
): result is EventPageScrapeResult {
  return (
    typeof result === "object" &&
    result !== null &&
    typeof result.success === "boolean" &&
    typeof result.message === "string" &&
    (result.data === null || typeof result.data === "object")
  );
}
