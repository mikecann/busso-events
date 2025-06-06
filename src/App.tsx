import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInForm } from "./SignInForm";
import { AuthenticatedApp } from "./components/AuthenticatedApp";
import { PublicApp } from "./components/PublicApp";
import { useState } from "react";

export default function App() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <main className="container mx-auto">
      <AuthLoading>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        {showLogin ? (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-md">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to EventFinder</h1>
                <p className="text-gray-600">Sign in to manage your event subscriptions</p>
              </div>
              <SignInForm />
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowLogin(false)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ← Back to browse events
                </button>
              </div>
            </div>
          </div>
        ) : (
          <PublicApp onNavigateToLogin={() => setShowLogin(true)} />
        )}
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
    </main>
  );
}
