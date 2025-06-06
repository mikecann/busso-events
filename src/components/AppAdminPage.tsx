import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";

interface AppAdminPageProps {
  onNavigateToSources: () => void;
}

export function AppAdminPage({ onNavigateToSources }: AppAdminPageProps) {
  const eventsReadyForScraping = useQuery(api.eventsAdmin.getEventsReadyForScraping);
  const generateMissingEmbeddings = useAction(api.embeddings.generateMissingEmbeddings);
  const queueStats = useQuery(api.emailQueue.getQueueStats);
  
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);

  const handleGenerateEmbeddings = async () => {
    setIsGeneratingEmbeddings(true);
    try {
      const result = await generateMissingEmbeddings({});
      toast.success(`Generated embeddings for ${result.processed} events. ${result.failed} failed.`);
    } catch (error) {
      toast.error("Failed to generate embeddings");
      console.error("Error generating embeddings:", error);
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage events, sources, and system operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Events Ready for Scraping */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Events Ready for Scraping</h3>
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {eventsReadyForScraping?.length || 0}
          </div>
          <p className="text-sm text-gray-600">
            Events that haven't been scraped in the last 24 hours
          </p>
        </div>

        {/* Email Queue Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Queue</h3>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Unsent:</span>
              <span className="font-medium text-orange-600">{queueStats?.unsent || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Sent:</span>
              <span className="font-medium text-green-600">{queueStats?.sent || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total:</span>
              <span className="font-medium">{queueStats?.total || 0}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={handleGenerateEmbeddings}
              disabled={isGeneratingEmbeddings}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              {isGeneratingEmbeddings ? "Generating..." : "🧠 Generate Missing Embeddings"}
            </button>
          </div>
        </div>
      </div>

      {/* Management Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Event Sources Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Event Sources</h3>
          <p className="text-gray-600 mb-4">
            Manage the sources from which events are scraped
          </p>
          <button
            onClick={onNavigateToSources}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Manage Sources
          </button>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">System Health</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Scraping System:</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Email System:</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Embeddings:</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
