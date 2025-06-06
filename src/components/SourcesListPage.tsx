import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";

interface SourcesListPageProps {
  onBack: () => void;
  onNavigateToAddSource: () => void;
}

export function SourcesListPage({ onBack, onNavigateToAddSource }: SourcesListPageProps) {
  const sources = useQuery(api.eventSources.list);
  const updateSource = useMutation(api.eventSources.update);
  const deleteSource = useMutation(api.eventSources.remove);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateSource({
        id: id as any,
        isActive: !currentActive,
      });
      toast.success(`Source ${!currentActive ? "activated" : "deactivated"}`);
    } catch (error) {
      toast.error("Failed to update source");
      console.error("Error updating source:", error);
    }
  };

  const handleEdit = (source: any) => {
    setEditingId(source._id);
    setEditName(source.name);
    setEditUrl(source.startingUrl);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateSource({
        id: id as any,
        name: editName,
        startingUrl: editUrl,
      });
      setEditingId(null);
      toast.success("Source updated");
    } catch (error) {
      toast.error("Failed to update source");
      console.error("Error updating source:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditUrl("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this source?")) {
      return;
    }

    try {
      await deleteSource({ id: id as any });
      toast.success("Source deleted");
    } catch (error) {
      toast.error("Failed to delete source");
      console.error("Error deleting source:", error);
    }
  };

  if (sources === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
          Back to Admin
        </button>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Event Sources</h1>
            <p className="text-gray-600 mt-2">Manage sources for event scraping</p>
          </div>
          <button
            onClick={onNavigateToAddSource}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            + Add Source
          </button>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-gray-400 text-6xl mb-4">🌐</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No sources configured</h3>
          <p className="text-gray-600 mb-6">
            Add your first event source to start scraping events
          </p>
          <button
            onClick={onNavigateToAddSource}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Add Your First Source
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sources.map((source) => (
            <div
              key={source._id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-3 h-3 rounded-full ${
                      source.isActive ? "bg-green-500" : "bg-gray-400"
                    }`}></div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      source.isActive 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {source.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {editingId === source._id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Source name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="Starting URL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(source._id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {source.name}
                      </h3>
                      <p className="text-gray-600 mb-3 break-all">
                        {source.startingUrl}
                      </p>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Last scraped:</span>
                        <span className="ml-1">{formatDate(source.dateLastScrape)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(source._id, source.isActive)}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      source.isActive
                        ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                        : "bg-green-100 hover:bg-green-200 text-green-800"
                    }`}
                  >
                    {source.isActive ? "Pause" : "Activate"}
                  </button>
                  
                  {editingId !== source._id && (
                    <button
                      onClick={() => handleEdit(source)}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDelete(source._id)}
                    className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
