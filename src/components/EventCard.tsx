import { Doc } from "../../convex/_generated/dataModel";

interface EventCardProps {
  event: Doc<"events">;
  onClick: () => void;
  onDebugClick?: () => void;
  showDebugButton?: boolean;
}

export function EventCard({ event, onClick, onDebugClick, showDebugButton }: EventCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-48 object-cover cursor-pointer"
          onClick={onClick}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      
      <div className="p-6">
        <h3 
          className="text-lg font-semibold text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition-colors line-clamp-2"
          onClick={onClick}
        >
          {event.title}
        </h3>
        
        <div className="flex items-center text-gray-600 text-sm mb-3">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDate(event.eventDate)} at {formatTime(event.eventDate)}
        </div>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {event.description}
        </p>
        
        <div className="flex gap-2">
          <button
            onClick={onClick}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            View Details
          </button>
          
          {showDebugButton && onDebugClick && (
            <button
              onClick={onDebugClick}
              className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-3 rounded-lg font-medium transition-colors"
              title="Debug Event"
            >
              🔧
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
