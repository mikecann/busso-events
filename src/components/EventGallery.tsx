import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { EventCard } from "./EventCard";
import { SearchBar } from "./SearchBar";
import { DateFilter } from "./DateFilter";
import { Id } from "../../convex/_generated/dataModel";

interface EventGalleryProps {
  onEventClick: (eventId: Id<"events">) => void;
  onEventDebugClick?: (eventId: Id<"events">) => void;
}

export function EventGallery({ onEventClick, onEventDebugClick }: EventGalleryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "week" | "month" | "3months">("all");
  
  const events = useQuery(api.events.search, { 
    searchTerm: searchTerm.trim() || "",
    dateFilter 
  });

  if (events === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchBar 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
        <DateFilter 
          value={dateFilter}
          onChange={setDateFilter}
        />
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No events found</h3>
          <p className="text-gray-600">
            {searchTerm ? "Try adjusting your search terms" : "Check back later for new events"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              onClick={() => onEventClick(event._id)}
              onDebugClick={onEventDebugClick ? () => onEventDebugClick(event._id) : undefined}
              showDebugButton={!!onEventDebugClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
