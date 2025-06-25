# Convex Backend Functions

This directory contains the backend functions for the Busselton Events application.

## Structure

- **events/** - Event management, scraping, and administration
- **subscriptions/** - User subscriptions and matching logic
- **auth.ts** - Authentication configuration
- **schema.ts** - Database schema definitions
- **scraping.ts** - Web scraping utilities for event sources
- **embeddings.ts** - AI embedding generation for semantic search
- **emailQueue.ts** - Email notification system
- **crons.ts** - Scheduled tasks (scraping, notifications)

## Key Features

### Event Management
- Event creation and updates
- Web scraping from event sources
- AI-powered event categorization and description enhancement

### Smart Subscriptions
- Natural language subscription prompts
- Semantic matching using OpenAI embeddings
- Automated email notifications

### Admin Functions
- Event source management
- Batch processing operations
- System monitoring and debugging

## Environment Variables Required

See `.env.example` in the project root for required environment variables.

## Development

Functions are automatically deployed when you run `convex dev`. 

For more information about Convex functions:
- [Convex Documentation](https://docs.convex.dev/)
- [Query Functions](https://docs.convex.dev/functions/query-functions)
- [Mutation Functions](https://docs.convex.dev/functions/mutation-functions)
- [Action Functions](https://docs.convex.dev/functions/actions)
