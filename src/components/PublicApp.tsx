import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { EventGallery } from "./EventGallery";
import { EventDetailPage } from "./EventDetailPage";
import { Id } from "../../convex/_generated/dataModel";

type Page = "home" | "event-detail" | "login";

interface PublicAppProps {
  onNavigateToLogin: () => void;
}

export function PublicApp({ onNavigateToLogin }: PublicAppProps) {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [selectedEventId, setSelectedEventId] = useState<Id<"events"> | null>(null);

  const navigateToHome = () => {
    setCurrentPage("home");
    setSelectedEventId(null);
  };

  const navigateToEventDetail = (eventId: Id<"events">) => {
    setSelectedEventId(eventId);
    setCurrentPage("event-detail");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={navigateToHome}
              className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
            >
              EventFinder
            </button>
            
            <button
              onClick={onNavigateToLogin}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {currentPage === "home" && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Discover Amazing Events
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Find events that match your interests and never miss out
              </p>
              <button
                onClick={onNavigateToLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors"
              >
                Get Started - Sign In
              </button>
            </div>
            
            <EventGallery 
              onEventClick={navigateToEventDetail}
            />
          </div>
        )}
        
        {currentPage === "event-detail" && selectedEventId && (
          <EventDetailPage 
            eventId={selectedEventId} 
            onBack={navigateToHome}
          />
        )}
      </main>
    </div>
  );
}
