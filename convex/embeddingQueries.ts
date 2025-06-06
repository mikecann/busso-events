import { internalQuery } from "./_generated/server";

// Internal query to get all events
export const getAllEvents = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("events").collect();
  },
});

// Internal query to get events without embeddings
export const getEventsWithoutEmbeddings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allEvents = await ctx.db.query("events").collect();
    return allEvents.filter(event => !event.descriptionEmbedding);
  },
});
