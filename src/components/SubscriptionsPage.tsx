import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";

interface SubscriptionsPageProps {
  onCreateNew: () => void;
}

export function SubscriptionsPage({ onCreateNew }: SubscriptionsPageProps) {
  const subscriptions = useQuery(api.subscriptions.list);
  const updateSubscription = useMutation(api.subscriptions.update);
  const deleteSubscription = useMutation(api.subscriptions.remove);
  const sendEmailNow = useAction(api.emailSending.sendSubscriptionEmail);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff <= 0) {
      return "Ready to send";
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateSubscription({
        id: id as any,
        isActive: !currentActive,
      });
      toast.success(`Subscription ${!currentActive ? "activated" : "deactivated"}`);
    } catch (error) {
      toast.error("Failed to update subscription");
      console.error("Error updating subscription:", error);
    }
  };

  const handleEdit = (subscription: any) => {
    setEditingId(subscription._id);
    setEditPrompt(subscription.prompt);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateSubscription({
        id: id as any,
        prompt: editPrompt,
      });
      setEditingId(null);
      toast.success("Subscription updated");
    } catch (error) {
      toast.error("Failed to update subscription");
      console.error("Error updating subscription:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditPrompt("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subscription?")) {
      return;
    }

    try {
      await deleteSubscription({ id: id as any });
      toast.success("Subscription deleted");
    } catch (error) {
      toast.error("Failed to delete subscription");
      console.error("Error deleting subscription:", error);
    }
  };

  const handleSendEmailNow = async (subscriptionId: string) => {
    setSendingEmailFor(subscriptionId);
    try {
      const result = await sendEmailNow({ subscriptionId: subscriptionId as any });
      if (result.success) {
        toast.success(`Email sent successfully! ${result.eventsSent} events included.`);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to send email");
      console.error("Error sending email:", error);
    } finally {
      setSendingEmailFor(null);
    }
  };

  if (subscriptions === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event Subscriptions</h1>
          <p className="text-gray-600 mt-2">Manage your event notification preferences</p>
        </div>
        <button
          onClick={onCreateNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          + Create Subscription
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-gray-400 text-6xl mb-4">📧</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No subscriptions yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first subscription to get notified about events that match your interests
          </p>
          <button
            onClick={onCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create Your First Subscription
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {subscriptions.map((subscription) => (
            <div
              key={subscription._id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-3 h-3 rounded-full ${
                      subscription.isActive ? "bg-green-500" : "bg-gray-400"
                    }`}></div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      subscription.isActive 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {subscription.isActive ? "Active" : "Inactive"}
                    </span>
                    {subscription.totalQueuedEvents > 0 && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        {subscription.totalQueuedEvents} queued event{subscription.totalQueuedEvents > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {editingId === subscription._id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(subscription._id)}
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
                      <p className="text-gray-900 mb-3 leading-relaxed">
                        "{subscription.prompt}"
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Email frequency:</span>
                          <span className="ml-1">{subscription.emailFrequencyHours}h</span>
                        </div>
                        <div>
                          <span className="font-medium">Last email:</span>
                          <span className="ml-1">
                            {subscription.lastEmailSent 
                              ? formatDate(subscription.lastEmailSent)
                              : "Never"
                            }
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Next email:</span>
                          <span className={`ml-1 ${
                            subscription.nextEmailScheduled <= Date.now() 
                              ? "text-green-600 font-medium" 
                              : ""
                          }`}>
                            {formatRelativeTime(subscription.nextEmailScheduled)}
                          </span>
                        </div>
                      </div>

                      {subscription.queuedEvents.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">
                            Queued Events ({subscription.totalQueuedEvents})
                          </h4>
                          <div className="space-y-2">
                            {subscription.queuedEvents.map((queueItem: any) => (
                              <div key={queueItem._id} className="text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-blue-800">
                                    {queueItem.event.title}
                                  </span>
                                  <span className="text-blue-600 text-xs">
                                    ({(queueItem.matchScore * 100).toFixed(0)}% match)
                                  </span>
                                </div>
                                <div className="text-blue-600 text-xs">
                                  📅 {formatDate(queueItem.event.eventDate)}
                                </div>
                              </div>
                            ))}
                            {subscription.totalQueuedEvents > 5 && (
                              <div className="text-xs text-blue-600">
                                ... and {subscription.totalQueuedEvents - 5} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {subscription.totalQueuedEvents > 0 && (
                    <button
                      onClick={() => handleSendEmailNow(subscription._id)}
                      disabled={sendingEmailFor === subscription._id}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      {sendingEmailFor === subscription._id ? "Sending..." : "📧 Send Email Now"}
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleToggleActive(subscription._id, subscription.isActive)}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      subscription.isActive
                        ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                        : "bg-green-100 hover:bg-green-200 text-green-800"
                    }`}
                  >
                    {subscription.isActive ? "Pause" : "Activate"}
                  </button>
                  
                  {editingId !== subscription._id && (
                    <button
                      onClick={() => handleEdit(subscription)}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDelete(subscription._id)}
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
