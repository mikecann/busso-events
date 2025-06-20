import { defineApp } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config";

const app = defineApp();

// Configure workpool for event scraping with limited parallelism to avoid rate limits
app.use(workpool, { name: "eventScrapeWorkpool" });

export default app;
