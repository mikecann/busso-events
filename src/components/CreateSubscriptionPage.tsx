import { useState, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface CreateSubscriptionPageProps {
  onBack: () => void;
}

export function CreateSubscriptionPage({ onBack }: CreateSubscriptionPageProps) {
  const createSubscription = useMutation(api.subscriptions.create);
  const previewMatchingEvents = useAction(api.subscriptionMatching.previewMatchingEvents);
  
  const [prompt, setPrompt] = useState("");
  const [debouncedPrompt, setDebouncedPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewEvents, setPreviewEvents] = useState<any[] | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Debounce the prompt for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPrompt(prompt);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [prompt]);

  // Load preview events when debounced prompt changes
  useEffect(() => {
    if (!debouncedPrompt.trim()) {
      setPreviewEvents(null);
      return;
    }

    const loadPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const events = await previewMatchingEvents({ prompt: debouncedPrompt });
        setPreviewEvents(events);
      } catch (error) {
        console.error("Error loading preview events:", error);
        setPreviewEvents([]);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadPreview();
  }, [debouncedPrompt, previewMatchingEvents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createSubscription({
        prompt: prompt.trim(),
        isActive: true,
      });
      toast.success("Subscription created successfully!");
      onBack();
    } catch (error) {
      toast.error("Failed to create subscription");
      console.error("Error creating subscription:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatEventDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const getScoreColor = (score: number, meetsThreshold: boolean) => {
    if (!meetsThreshold) return "text-gray-500 bg-gray-100";
    if (score >= 0.8) return "text-green-600 bg-green-50";
    if (score >= 0.6) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getMatchTypeColor = (matchType: string, meetsThreshold: boolean) => {
    if (!meetsThreshold) return "text-gray-500 bg-gray-100";
    if (matchType === "semantic") return "text-blue-600 bg-blue-50";
    return "text-purple-600 bg-purple-50";
  };

  const getCardStyle = (meetsThreshold: boolean) => {
    if (!meetsThreshold) {
      return "border border-gray-200 rounded-lg p-4 opacity-60 bg-gray-50";
    }
    return "border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors";
  };

  // Separate events into those that meet threshold and those that don't
  const eventsAboveThreshold = previewEvents?.filter(event => event.meetsThreshold) || [];
  const eventsBelowThreshold = previewEvents?.filter(event => !event.meetsThreshold) || [];

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
          Back to Subscriptions
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create Event Subscription</h1>
        <p className="text-gray-600 mt-2">Get notified about events that match your interests</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              What kind of events are you interested in?
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="e.g., AI and machine learning conferences, startup networking events, tech talks about web development..."
              rows={4}
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              Describe the types of events you'd like to be notified about. Be as specific or general as you'd like.
            </p>
          </div>

          {/* Preview Section */}
          {debouncedPrompt.trim() && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Preview: Events matching your interests
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Here's a sample of events that match your description (with match scores):
              </p>
              
              {isLoadingPreview ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Finding matching events...</span>
                </div>
              ) : previewEvents === null ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="text-gray-400 text-3xl mb-2">⏳</div>
                  <p className="text-gray-600">Loading preview...</p>
                </div>
              ) : previewEvents.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="text-gray-400 text-3xl mb-2">🔍</div>
                  <p className="text-gray-600">No events found matching this description</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Try adjusting your prompt or check back later for new events
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Events Above Threshold */}
                  {eventsAboveThreshold.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                        <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                        Events that will trigger notifications ({eventsAboveThreshold.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eventsAboveThreshold.map((event: any) => (
                          <div
                            key={event._id}
                            className={getCardStyle(event.meetsThreshold)}
                          >
                            {event.imageUrl && (
                              <img
                                src={event.imageUrl}
                                alt={event.title}
                                className="w-full h-32 object-cover rounded-lg mb-3"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getScoreColor(event.score, event.meetsThreshold)}`}>
                                  Score: {event.score.toFixed(3)}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getMatchTypeColor(event.matchType, event.meetsThreshold)}`}>
                                  {event.matchType}
                                </span>
                              </div>
                              <h4 className="font-medium text-gray-900 text-sm line-clamp-2">
                                {event.title}
                              </h4>
                              <div className="text-xs text-gray-600">
                                📅 {formatEventDate(event.eventDate)}
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-3">
                                {event.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Events Below Threshold */}
                  {eventsBelowThreshold.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-500 mb-3 flex items-center">
                        <span className="w-3 h-3 bg-gray-400 rounded-full mr-2"></span>
                        Below relevance threshold - won't trigger notifications ({eventsBelowThreshold.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eventsBelowThreshold.map((event: any) => (
                          <div
                            key={event._id}
                            className={getCardStyle(event.meetsThreshold)}
                          >
                            {event.imageUrl && (
                              <img
                                src={event.imageUrl}
                                alt={event.title}
                                className="w-full h-32 object-cover rounded-lg mb-3 grayscale"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getScoreColor(event.score, event.meetsThreshold)}`}>
                                  Score: {event.score.toFixed(3)}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getMatchTypeColor(event.matchType, event.meetsThreshold)}`}>
                                  {event.matchType}
                                </span>
                                <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-600">
                                  Below {event.thresholdValue}
                                </span>
                              </div>
                              <h4 className="font-medium text-gray-500 text-sm line-clamp-2">
                                {event.title}
                              </h4>
                              <div className="text-xs text-gray-500">
                                📅 {formatEventDate(event.eventDate)}
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-3">
                                {event.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {previewEvents && previewEvents.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Found {eventsAboveThreshold.length} relevant events</strong> that will trigger notifications. 
                    {eventsBelowThreshold.length > 0 && (
                      <span> {eventsBelowThreshold.length} additional events are shown but fall below the relevance threshold.</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting || !prompt.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isSubmitting ? "Creating..." : "Create Subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
