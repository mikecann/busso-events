import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Header } from "./Header";
import { EventGallery } from "./EventGallery";
import { SubscriptionsPage } from "./SubscriptionsPage";
import { CreateSubscriptionPage } from "./CreateSubscriptionPage";
import { EventDetailPage } from "./EventDetailPage";
import { AppAdminPage } from "./AppAdminPage";
import { EventDebugPage } from "./EventDebugPage";
import { SourcesListPage } from "./SourcesListPage";
import { AddSourcePage } from "./AddSourcePage";
import { Id } from "../../convex/_generated/dataModel";

type Page = 
  | "home" 
  | "subscriptions" 
  | "create-subscription" 
  | "event-detail" 
  | "admin" 
  | "event-debug"
  | "sources"
  | "add-source";

export function AuthenticatedApp() {
  const user = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.users.isCurrentUserAdmin);
  
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [selectedEventId, setSelectedEventId] = useState<Id<"events"> | null>(null);

  const navigateToHome = () => {
    setCurrentPage("home");
    setSelectedEventId(null);
  };

  const navigateToSubscriptions = () => {
    setCurrentPage("subscriptions");
  };

  const navigateToCreateSubscription = () => {
    setCurrentPage("create-subscription");
  };

  const navigateToEventDetail = (eventId: Id<"events">) => {
    setSelectedEventId(eventId);
    setCurrentPage("event-detail");
  };

  const navigateToAdmin = () => {
    setCurrentPage("admin");
  };

  const navigateToEventDebug = (eventId: Id<"events">) => {
    setSelectedEventId(eventId);
    setCurrentPage("event-debug");
  };

  const navigateToSources = () => {
    setCurrentPage("sources");
  };

  const navigateToAddSource = () => {
    setCurrentPage("add-source");
  };

  if (user === undefined || isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        onNavigateHome={navigateToHome}
        onNavigateSubscriptions={navigateToSubscriptions}
        onNavigateAdmin={isAdmin ? navigateToAdmin : undefined}
        currentPage={currentPage}
      />
      
      <main className="container mx-auto px-4 py-8">
        {currentPage === "home" && (
          <EventGallery 
            onEventClick={navigateToEventDetail}
            onEventDebugClick={isAdmin ? navigateToEventDebug : undefined}
          />
        )}
        
        {currentPage === "subscriptions" && (
          <SubscriptionsPage 
            onCreateNew={navigateToCreateSubscription}
          />
        )}
        
        {currentPage === "create-subscription" && (
          <CreateSubscriptionPage onBack={navigateToSubscriptions} />
        )}
        
        {currentPage === "event-detail" && selectedEventId && (
          <EventDetailPage 
            eventId={selectedEventId} 
            onBack={navigateToHome}
            onDebugClick={isAdmin ? () => navigateToEventDebug(selectedEventId) : undefined}
          />
        )}
        
        {currentPage === "admin" && isAdmin && (
          <AppAdminPage 
            onNavigateToSources={navigateToSources}
          />
        )}
        
        {currentPage === "event-debug" && selectedEventId && isAdmin && (
          <EventDebugPage 
            eventId={selectedEventId as string}
            onBack={navigateToAdmin}
          />
        )}
        
        {currentPage === "sources" && isAdmin && (
          <SourcesListPage 
            onBack={navigateToAdmin}
            onNavigateToAddSource={navigateToAddSource}
          />
        )}
        
        {currentPage === "add-source" && isAdmin && (
          <AddSourcePage onBack={navigateToSources} />
        )}
      </main>
    </div>
  );
}
