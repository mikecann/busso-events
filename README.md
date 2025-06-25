# Busselton Events Aggregator

A comprehensive events discovery and subscription platform for Busselton, Western Australia. This application automatically aggregates events from various sources around Busselton and provides intelligent subscription services to help locals never miss out on events that matter to them.

## Features

### 🎯 **Smart Event Discovery**
- Automatically scrapes events from multiple sources across Busselton
- Advanced search functionality with date filtering
- Semantic search powered by AI to find events matching your interests
- Beautiful, responsive event gallery with rich event details

### 📬 **Intelligent Subscriptions**
- Create custom subscriptions using natural language prompts (e.g., "live music events", "family-friendly activities")
- Get personalized email notifications when matching events are found
- All-events subscription option to stay updated on everything happening in Busselton
- Smart matching algorithms that understand context and intent

### 🔧 **Admin Management**
- Manage event sources and scraping schedules
- Monitor scraping progress and system health
- Debug tools for subscription matching and event processing
- User management and admin controls

### 🚀 **Modern Technology Stack**
- **Backend**: [Convex](https://convex.dev/) - Real-time database and serverless functions
- **Frontend**: React + Vite - Fast, modern web application
- **UI**: Mantine - Beautiful, accessible components
- **Authentication**: Convex Auth - Secure user management
- **AI**: OpenAI embeddings for semantic search and matching
- **Email**: Resend for reliable email notifications

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or bun

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/busso-events.git
cd busso-events
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy the example env file and configure your keys
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```
# Convex deployment URL (get from convex dashboard)
VITE_CONVEX_URL=your_convex_url

# OpenAI API key for semantic search
OPENAI_API_KEY=your_openai_key

# Resend API key for email notifications  
RESEND_API_KEY=your_resend_key
```

5. Run the development server:
```bash
npm run dev
```

This will start both the frontend (Vite) and backend (Convex) development servers.

## Usage

### For Event Attendees
1. **Browse Events**: Visit the site to see all upcoming events in Busselton
2. **Search**: Use the search bar to find specific types of events
3. **Create Account**: Sign up to create custom subscriptions
4. **Set Subscriptions**: Create subscriptions like "outdoor concerts" or "art exhibitions" 
5. **Get Notified**: Receive email notifications when matching events are found

### For Administrators
1. **Add Event Sources**: Configure new websites to scrape for events
2. **Monitor Scraping**: Check the status of automatic event collection
3. **Manage Events**: Edit or remove events as needed
4. **View Analytics**: Monitor subscription performance and user engagement

## Development

### Project Structure
```
busso-events/
├── convex/              # Backend code (Convex functions)
│   ├── events/         # Event management functions
│   ├── subscriptions/  # Subscription and matching logic
│   └── schema.ts       # Database schema
├── src/                # Frontend code (React)
│   ├── components/     # Shared UI components
│   ├── events/         # Event-related pages and components
│   ├── subscriptions/  # Subscription management UI
│   └── utils/          # Utility functions
└── public/             # Static assets
```

### Key Commands
- `npm run dev` - Start development servers
- `npm run build` - Build for production
- `npm run lint` - Run TypeScript and ESLint checks
- `convex dev` - Start Convex backend only
- `npm run dev:frontend` - Start Vite frontend only

## Deployment

The application is designed to be deployed on:
- **Frontend**: Vercel, Netlify, or similar
- **Backend**: Convex (automatically deployed when pushing to convex)

See the [Convex deployment guide](https://docs.convex.dev/production/hosting) for detailed instructions.

## Contributing

This is a community project for Busselton! Contributions are welcome:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE.txt](LICENSE.txt) file for details.

## About Busselton

This application serves the vibrant community of Busselton, Western Australia - a beautiful coastal city known for its iconic jetty, world-class wineries, and thriving arts and culture scene. Our goal is to help locals and visitors discover all the amazing events happening in our region.

---

Built with ❤️ for the Busselton community
