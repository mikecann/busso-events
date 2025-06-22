import { defineApp } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config";

const app = defineApp();

// Configure workpool for event scraping with limited parallelism to avoid rate limits
app.use(workpool, { name: "eventScrapeWorkpool" });

// Configure workpool for embedding generation with limited parallelism to avoid OpenAI rate limits
app.use(workpool, { name: "eventEmbeddingWorkpool" });

// Configure workpool for subscription matching with maximum parallelism of 1
app.use(workpool, { name: "subscriptionMatchWorkpool" });

export default app;
