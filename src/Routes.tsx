import { useRoute, routes } from "./router";
import { AuthRequired } from "./components/AuthRequired";
import { AdminRequired } from "./components/AdminRequired";
import { AuthenticatedPageLayout } from "./components/AuthenticatedPageLayout";
import { HomePage } from "./components/HomePage";
import { LoginPage } from "./components/LoginPage";
import { EventDetailPublic } from "./events/EventDetailPublic";
import { SubscriptionsPage } from "./subscriptions/SubscriptionsPage";
import { CreateSubscriptionPage } from "./subscriptions/CreateSubscriptionPage";
import { SubscriptionDetailPage } from "./subscriptions/SubscriptionDetailPage";
import { AppAdminPage } from "./components/AppAdminPage";
import { EventDebugPage } from "./events/debug/EventDebugPage";
import { SubscriptionDebugPage } from "./subscriptions/debug/SubscriptionDebugPage";
import { WorkpoolDebugPage } from "./components/WorkpoolDebugPage";
import { SourcesListPage } from "./components/SourcesListPage";
import { AddSourcePage } from "./components/AddSourcePage";
import { SourceDetailPage } from "./components/SourceDetailPage";
import { NotFoundPage } from "./components/NotFoundPage";
import { Id } from "../convex/_generated/dataModel";
import { exhaustiveCheck } from "../shared/misc";

export function Routes() {
  const route = useRoute();

  if (route.name === "home") return <HomePage />;

  if (route.name === "login") return <LoginPage />;

  if (route.name === "eventDetail")
    return <EventDetailPublic eventId={route.params.eventId} />;

  if (route.name === "subscriptions")
    return (
      <AuthRequired>
        <AuthenticatedPageLayout>
          <SubscriptionsPage
            onCreateNew={() => routes.createSubscription().push()}
            onNavigateToSubscription={(subscriptionId) =>
              routes.subscriptionDetail({ subscriptionId }).push()
            }
          />
        </AuthenticatedPageLayout>
      </AuthRequired>
    );

  if (route.name === "createSubscription")
    return (
      <AuthRequired>
        <AuthenticatedPageLayout>
          <CreateSubscriptionPage
            onBack={() => routes.subscriptions().push()}
          />
        </AuthenticatedPageLayout>
      </AuthRequired>
    );

  if (route.name === "subscriptionDetail")
    return (
      <AuthRequired>
        <AuthenticatedPageLayout>
          <SubscriptionDetailPage
            subscriptionId={route.params.subscriptionId as Id<"subscriptions">}
            onBack={() => routes.subscriptions().push()}
          />
        </AuthenticatedPageLayout>
      </AuthRequired>
    );

  if (route.name === "admin")
    return (
      <AdminRequired>
        <AuthenticatedPageLayout>
          <AppAdminPage
            onNavigateToSources={() => routes.sources().push()}
            onNavigateToSubscriptionDebug={() =>
              routes.subscriptionDebug().push()
            }
            onNavigateToWorkpoolDebug={(workpoolType) =>
              routes.workpoolDebug({ workpoolType }).push()
            }
          />
        </AuthenticatedPageLayout>
      </AdminRequired>
    );

  if (route.name === "sources")
    return (
      <AdminRequired>
        <AuthenticatedPageLayout>
          <SourcesListPage
            onBack={() => routes.admin().push()}
            onNavigateToAddSource={() => routes.addSource().push()}
            onNavigateToSourceDetail={(sourceId) =>
              routes.sourceDetail({ sourceId }).push()
            }
          />
        </AuthenticatedPageLayout>
      </AdminRequired>
    );

  if (route.name === "addSource")
    return (
      <AdminRequired>
        <AuthenticatedPageLayout>
          <AddSourcePage onBack={() => routes.sources().push()} />
        </AuthenticatedPageLayout>
      </AdminRequired>
    );

  if (route.name === "sourceDetail")
    return (
      <AdminRequired>
        <AuthenticatedPageLayout>
          <SourceDetailPage
            sourceId={route.params.sourceId}
            onBack={() => routes.sources().push()}
          />
        </AuthenticatedPageLayout>
      </AdminRequired>
    );

  if (route.name === "eventDebug")
    return (
      <AdminRequired>
        <AuthenticatedPageLayout>
          <EventDebugPage
            eventId={route.params.eventId}
            onBack={() => {
              // Use browser history to go back to where we came from
              window.history.back();
            }}
          />
        </AuthenticatedPageLayout>
      </AdminRequired>
    );

  if (route.name === "subscriptionDebug")
    return (
      <AdminRequired>
        <AuthenticatedPageLayout>
          <SubscriptionDebugPage onBack={() => routes.admin().push()} />
        </AuthenticatedPageLayout>
      </AdminRequired>
    );

  if (route.name === "workpoolDebug")
    return (
      <AdminRequired>
        <AuthenticatedPageLayout>
          <WorkpoolDebugPage
            workpoolType={
              route.params.workpoolType as
                | "eventScrapeWorkpool"
                | "eventEmbeddingWorkpool"
                | "subscriptionMatchWorkpool"
            }
            onBack={() => routes.admin().push()}
            onNavigateToEventDebug={(eventId) =>
              routes.eventDebug({ eventId: eventId as Id<"events"> }).push()
            }
          />
        </AuthenticatedPageLayout>
      </AdminRequired>
    );

  if (route.name === false) return <NotFoundPage />;

  exhaustiveCheck(route);
}
