import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Helper function to parse date and find the closest future date
function parseEventDate(dateString: string): number {
  if (!dateString || typeof dateString !== 'string') {
    return Date.now(); // Default to today if no date
  }

  const now = Date.now();
  const dates: Date[] = [];

  // Try to extract multiple dates from the string
  const datePatterns = [
    // ISO format: 2024-01-15
    /\b\d{4}-\d{2}-\d{2}\b/g,
    // US format: 01/15/2024, 1/15/2024
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
    // European format: 15/01/2024, 15.01.2024
    /\b\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4}\b/g,
    // Month day year: January 15, 2024, Jan 15 2024
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi,
  ];

  // Extract all potential dates
  for (const pattern of datePatterns) {
    const matches = dateString.match(pattern);
    if (matches) {
      for (const match of matches) {
        try {
          const date = new Date(match);
          if (!isNaN(date.getTime())) {
            dates.push(date);
          }
        } catch (e) {
          // Ignore invalid dates
        }
      }
    }
  }

  // If no dates found, try parsing the entire string
  if (dates.length === 0) {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        dates.push(date);
      }
    } catch (e) {
      // Ignore invalid date
    }
  }

  // If still no dates, return current time
  if (dates.length === 0) {
    return now;
  }

  // Find the closest future date, or the latest date if none are in the future
  const futureDates = dates.filter(date => date.getTime() > now);
  
  if (futureDates.length > 0) {
    // Return the earliest future date
    return Math.min(...futureDates.map(d => d.getTime()));
  } else {
    // Return the latest date (even if it's in the past)
    return Math.max(...dates.map(d => d.getTime()));
  }
}

export const seedEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if events already exist
    const existingEvents = await ctx.db.query("events").take(1);
    if (existingEvents.length > 0) {
      console.log("Events already exist, skipping seed");
      return;
    }

    const sampleEvents = [
      {
        title: "Tech Meetup: AI and Machine Learning",
        description: "Join us for an exciting evening discussing the latest trends in AI and machine learning. We'll have presentations from industry experts and networking opportunities.",
        eventDate: "2024-02-15T18:00:00Z",
        imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=400&fit=crop",
        url: "https://example.com/events/tech-meetup-ai-ml",
      },
      {
        title: "Startup Pitch Night",
        description: "Watch innovative startups pitch their ideas to a panel of investors. Great networking event for entrepreneurs and investors alike.",
        eventDate: "2024-02-20T19:00:00Z",
        imageUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=400&fit=crop",
        url: "https://example.com/events/startup-pitch-night",
      },
      {
        title: "Web Development Workshop",
        description: "Hands-on workshop covering modern web development techniques including React, Node.js, and cloud deployment strategies.",
        eventDate: "2024-02-25T10:00:00Z",
        imageUrl: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop",
        url: "https://example.com/events/web-dev-workshop",
      },
    ];

    for (const event of sampleEvents) {
      const eventTimestamp = parseEventDate(event.eventDate);
      
      const eventId = await ctx.db.insert("events", {
        title: event.title,
        description: event.description,
        eventDate: eventTimestamp,
        imageUrl: event.imageUrl,
        url: event.url,
        scrapedData: {
          originalEventDate: event.eventDate, // Store the original string
        },
      });

      // Schedule embedding generation for each seeded event
      await ctx.scheduler.runAfter(0, internal.embeddings.generateEventDescriptionEmbedding, {
        eventId,
      });
    }

    console.log(`Seeded ${sampleEvents.length} events`);
  },
});
