import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";

interface EventDebugPageProps {
  eventId: string;
  onBack: () => void;
}

export function EventDebugPage({ eventId, onBack }: EventDebugPageProps) {
  const event = useQuery(api.events.getById, { id: eventId as any });
  const updateEvent = useMutation(api.eventsAdmin.updateEvent);
  const deleteEvent = useMutation(api.eventsAdmin.deleteEvent);
  const scrapeEvent = useAction(api.eventsAdmin.scrapeEvent);
  const generateEmbedding = useAction(api.embeddings.generateEventEmbedding);
  const triggerSubscriptionMatching = useAction(api.subscriptionMatching.triggerSubscriptionMatchingForEvent);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isGeneratingEmbedding, setIsGeneratingEmbedding] = useState(false);
  const [isTriggeringMatching, setIsTriggeringMatching] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff <= 0) {
      return "Ready to run";
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  const handleEdit = (field: string, currentValue: any) => {
    setEditingField(field);
    setEditValues({ [field]: currentValue });
  };

  const handleSave = async (field: string) => {
    setIsUpdating(true);
    try {
      await updateEvent({
        id: eventId as any,
        [field]: editValues[field],
      });
      setEditingField(null);
      toast.success(`${field} updated successfully`);
    } catch (error) {
      toast.error(`Failed to update ${field}`);
      console.error("Error updating event:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValues({});
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteEvent({ id: eventId as any });
      toast.success("Event deleted successfully");
      onBack();
    } catch (error) {
      toast.error("Failed to delete event");
      console.error("Error deleting event:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleScrape = async () => {
    setIsScraping(true);
    try {
      const result = await scrapeEvent({ eventId: eventId as any });
      if (result.success) {
        toast.success("Event scraped successfully");
      } else {
        toast.error(`Scraping failed: ${result.message}`);
      }
    } catch (error) {
      toast.error("Failed to scrape event");
      console.error("Error scraping event:", error);
    } finally {
      setIsScraping(false);
    }
  };

  const handleGenerateEmbedding = async () => {
    setIsGeneratingEmbedding(true);
    try {
      await generateEmbedding({ eventId: eventId as any });
      toast.success("Embedding generated successfully");
    } catch (error) {
      toast.error("Failed to generate embedding");
      console.error("Error generating embedding:", error);
    } finally {
      setIsGeneratingEmbedding(false);
    }
  };

  const handleTriggerSubscriptionMatching = async () => {
    setIsTriggeringMatching(true);
    try {
      const result = await triggerSubscriptionMatching({ eventId: eventId as any });
      if (result.success) {
        toast.success("Subscription matching triggered successfully");
      } else {
        toast.error("Failed to trigger subscription matching");
      }
    } catch (error) {
      toast.error("Failed to trigger subscription matching");
      console.error("Error triggering subscription matching:", error);
    } finally {
      setIsTriggeringMatching(false);
    }
  };

  if (event === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Event not found</h3>
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Events
        </button>
      </div>
    );
  }

  const renderEditableField = (field: string, label: string, value: any, type: "text" | "textarea" | "datetime" = "text") => {
    const isEditing = editingField === field;
    
    return (
      <div className="border-b border-gray-200 py-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-700 mb-1">{label}</h4>
            {isEditing ? (
              <div className="space-y-2">
                {type === "textarea" ? (
                  <textarea
                    value={editValues[field] || ""}
                    onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={4}
                  />
                ) : type === "datetime" ? (
                  <input
                    type="datetime-local"
                    value={new Date(editValues[field] || value).toISOString().slice(0, 16)}
                    onChange={(e) => setEditValues({ ...editValues, [field]: new Date(e.target.value).getTime() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={editValues[field] || ""}
                    onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(field)}
                    disabled={isUpdating}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1 rounded text-sm"
                  >
                    {isUpdating ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {type === "datetime" ? (
                    <p className="text-gray-900">{formatDate(value)}</p>
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap">{value || "Not set"}</p>
                  )}
                </div>
                <button
                  onClick={() => handleEdit(field, value)}
                  className="ml-4 text-blue-600 hover:text-blue-800 text-sm"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Event Debug</h1>
            <p className="text-gray-600 mt-2">Debug and manage event details</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleScrape}
              disabled={isScraping}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {isScraping ? "Scraping..." : "🔍 Scrape"}
            </button>
            <button
              onClick={handleGenerateEmbedding}
              disabled={isGeneratingEmbedding}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {isGeneratingEmbedding ? "Generating..." : "🧠 Generate Embedding"}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {isDeleting ? "Deleting..." : "🗑️ Delete"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-1">
            {renderEditableField("title", "Title", event.title)}
            {renderEditableField("description", "Description", event.description, "textarea")}
            {renderEditableField("eventDate", "Event Date", event.eventDate, "datetime")}
            {renderEditableField("imageUrl", "Image URL", event.imageUrl)}
            {renderEditableField("url", "Event URL", event.url)}
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Event ID:</span>
              <span className="ml-2 text-gray-900 font-mono">{event._id}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <span className="ml-2 text-gray-900">{formatDate(event._creationTime)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Scraped:</span>
              <span className="ml-2 text-gray-900">
                {event.lastScraped ? formatDate(event.lastScraped) : "Never"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Has Embedding:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                event.descriptionEmbedding 
                  ? "bg-green-100 text-green-800" 
                  : "bg-red-100 text-red-800"
              }`}>
                {event.descriptionEmbedding ? "Yes" : "No"}
              </span>
            </div>
            {event.sourceId && (
              <div>
                <span className="font-medium text-gray-700">Source ID:</span>
                <span className="ml-2 text-gray-900 font-mono">{event.sourceId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Subscription Matching Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Subscription Matching</h2>
            <button
              onClick={handleTriggerSubscriptionMatching}
              disabled={isTriggeringMatching}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {isTriggeringMatching ? "Triggering..." : "🔄 Trigger Now"}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Scheduled Job ID:</span>
              <span className="ml-2 text-gray-900 font-mono">
                {event.subscriptionMatchScheduledId || "Not scheduled"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Scheduled For:</span>
              <span className={`ml-2 ${
                event.subscriptionMatchScheduledAt && event.subscriptionMatchScheduledAt <= Date.now()
                  ? "text-green-600 font-medium"
                  : "text-gray-900"
              }`}>
                {event.subscriptionMatchScheduledAt 
                  ? `${formatDate(event.subscriptionMatchScheduledAt)} (${formatRelativeTime(event.subscriptionMatchScheduledAt)})`
                  : "Not scheduled"
                }
              </span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Subscription matching</strong> runs automatically 8 hours after an event is created or updated. 
              It checks this event against all active user subscriptions and adds matching events to email queues.
            </p>
          </div>
        </div>

        {/* Scraped Data */}
        {event.scrapedData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Scraped Data</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {Object.entries(event.scrapedData).map(([key, value]) => (
                <div key={key}>
                  <span className="font-medium text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className="ml-2 text-gray-900">
                    {Array.isArray(value) ? value.join(", ") : value || "Not available"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Preview</h2>
          <div className="border border-gray-200 rounded-lg p-4">
            {event.imageUrl && (
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-48 object-cover rounded-lg mb-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{event.title}</h3>
            <p className="text-gray-600 mb-3">{event.description}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>📅 {formatDate(event.eventDate)}</span>
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                🔗 View Original
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
