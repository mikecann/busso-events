import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";

interface HeaderProps {
  onNavigateHome: () => void;
  onNavigateSubscriptions: () => void;
  onNavigateAdmin?: () => void;
  currentPage: string;
}

export function Header({ onNavigateHome, onNavigateSubscriptions, onNavigateAdmin, currentPage }: HeaderProps) {
  const user = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.users.isCurrentUserAdmin);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <button
              onClick={onNavigateHome}
              className={`text-xl font-bold transition-colors ${
                currentPage === "home" ? "text-blue-600" : "text-gray-900 hover:text-blue-600"
              }`}
            >
              EventFinder
            </button>
            
            <nav className="flex space-x-6">
              <button
                onClick={onNavigateHome}
                className={`font-medium transition-colors ${
                  currentPage === "home" 
                    ? "text-blue-600 border-b-2 border-blue-600 pb-1" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Events
              </button>
              
              <button
                onClick={onNavigateSubscriptions}
                className={`font-medium transition-colors ${
                  currentPage === "subscriptions" || currentPage === "create-subscription"
                    ? "text-blue-600 border-b-2 border-blue-600 pb-1" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Subscriptions
              </button>
              
              {isAdmin && onNavigateAdmin && (
                <button
                  onClick={onNavigateAdmin}
                  className={`font-medium transition-colors ${
                    currentPage === "admin" || currentPage === "event-debug" || currentPage === "add-event" || currentPage === "sources" || currentPage === "add-source"
                      ? "text-blue-600 border-b-2 border-blue-600 pb-1" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Admin
                </button>
              )}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  Welcome, {user.name || user.email || "User"}
                </span>
                {isAdmin && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                    Admin
                  </span>
                )}
              </div>
            )}
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
