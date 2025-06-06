import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface AddSourcePageProps {
  onBack: () => void;
}

export function AddSourcePage({ onBack }: AddSourcePageProps) {
  const createSource = useMutation(api.eventSources.create);
  const testScrape = useAction(api.eventSources.testScrape);

  const [formData, setFormData] = useState({
    name: "",
    startingUrl: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createSource({
        name: formData.name,
        startingUrl: formData.startingUrl,
      });
      toast.success("Event source created successfully!");
      onBack();
    } catch (error) {
      toast.error("Failed to create event source");
      console.error("Error creating source:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestScrape = async () => {
    if (!formData.startingUrl) {
      toast.error("Please enter a URL first");
      return;
    }

    setIsTesting(true);
    try {
      // First create the source temporarily to test it
      const sourceId = await createSource({
        name: formData.name || "Test Source",
        startingUrl: formData.startingUrl,
      });

      const result = await testScrape({
        sourceId,
      });

      if (result.success) {
        toast.success(`Test successful! ${result.message}`);
      } else {
        toast.error(`Test failed: ${result.message}`);
      }
    } catch (error) {
      toast.error("Test scrape failed");
      console.error("Error testing scrape:", error);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Sources
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Add Event Source</h1>
        <p className="text-gray-600 mt-2">
          Configure a new source for automatic event discovery
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Source Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Tech Events SF, Startup Meetups"
              required
            />
          </div>

          <div>
            <label
              htmlFor="startingUrl"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Starting URL
            </label>
            <input
              type="url"
              id="startingUrl"
              value={formData.startingUrl}
              onChange={(e) =>
                setFormData({ ...formData, startingUrl: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/events"
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              The URL where the scraper should start looking for events
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="text-yellow-600 mr-3 mt-0.5">⚠️</div>
              <div>
                <h3 className="text-sm font-medium text-yellow-900 mb-1">
                  Important Note
                </h3>
                <p className="text-sm text-yellow-800">
                  Make sure the URL you provide contains event listings that can
                  be scraped. The system will attempt to automatically discover
                  and extract event information.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleTestScrape}
              disabled={isTesting || !formData.startingUrl}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isTesting ? "Testing..." : "Test Scrape"}
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isSubmitting ? "Creating..." : "Create Source"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
