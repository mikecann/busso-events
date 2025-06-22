import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { EventGallery } from "./EventGallery";
import { EventDetailPage } from "../events/EventDetailPage";
import { SubscriptionsPage } from "../subscriptions/SubscriptionsPage";
import { CreateSubscriptionPage } from "../subscriptions/CreateSubscriptionPage";
import { SubscriptionDetailPage } from "../subscriptions/SubscriptionDetailPage";
import { AppAdminPage } from "./AppAdminPage";
import { EventDebugPage } from "../events/debug/EventDebugPage";
import { SubscriptionDebugPage } from "../subscriptions/debug/SubscriptionDebugPage";
import { WorkpoolDebugPage } from "./WorkpoolDebugPage";
import { SourcesListPage } from "./SourcesListPage";
import { AddSourcePage } from "./AddSourcePage";
import { SourceDetailPage } from "./SourceDetailPage";
import { Header } from "./Header";
import { useRoute, navigation } from "../router";
import {
  Container,
  Center,
  Loader,
  Stack,
  Title,
  Text,
  Button,
} from "@mantine/core";
import { Id } from "../../convex/_generated/dataModel";

export function AuthenticatedApp() {
  const user = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.users.isCurrentUserAdmin);
  const route = useRoute();

  if (user === undefined || isAdmin === undefined) {
    return (
      <Center style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
        <Loader size="lg" />
      </Center>
    );
  }

  // If we're on a public route, redirect to dashboard
  if (route.name === "home" || route.name === "login") {
    navigation.dashboard().replace();
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      <Header currentRoute={route.name} />

      <Container size="xl" py="xl">
        {route.name === "dashboard" && (
          <EventGallery
            onEventClick={(eventId) => navigation.eventDetail(eventId).push()}
          />
        )}

        {route.name === "subscriptions" && (
          <SubscriptionsPage
            onCreateNew={() => navigation.createSubscription().push()}
            onNavigateToSubscription={(subscriptionId) =>
              navigation.subscriptionDetail(subscriptionId).push()
            }
          />
        )}

        {route.name === "createSubscription" && (
          <CreateSubscriptionPage
            onBack={() => navigation.subscriptions().push()}
          />
        )}

        {route.name === "subscriptionDetail" && (
          <SubscriptionDetailPage
            subscriptionId={route.params.subscriptionId as Id<"subscriptions">}
            onBack={() => navigation.subscriptions().push()}
          />
        )}

        {route.name === "eventDetail" && (
          <EventDetailPage
            eventId={route.params.eventId}
            onBack={() => navigation.dashboard().push()}
            onDebugClick={
              isAdmin
                ? () =>
                    navigation
                      .eventDebug(route.params.eventId as Id<"events">)
                      .push()
                : undefined
            }
          />
        )}

        {route.name === "admin" && isAdmin && (
          <AppAdminPage
            onNavigateToSources={() => navigation.sources().push()}
            onNavigateToSubscriptionDebug={() =>
              navigation.subscriptionDebug().push()
            }
            onNavigateToWorkpoolDebug={(workpoolType) =>
              navigation.workpoolDebug(workpoolType).push()
            }
          />
        )}

        {route.name === "eventDebug" && isAdmin && (
          <EventDebugPage
            eventId={route.params.eventId}
            onBack={() => {
              // Use browser history to go back to where we came from
              window.history.back();
            }}
          />
        )}

        {route.name === "subscriptionDebug" && isAdmin && (
          <SubscriptionDebugPage onBack={() => navigation.admin().push()} />
        )}

        {route.name === "workpoolDebug" && isAdmin && (
          <WorkpoolDebugPage
            workpoolType={
              route.params.workpoolType as
                | "eventScrapeWorkpool"
                | "eventEmbeddingWorkpool"
                | "subscriptionMatchWorkpool"
            }
            onBack={() => navigation.admin().push()}
            onNavigateToEventDebug={(eventId) =>
              navigation.eventDebug(eventId as Id<"events">).push()
            }
          />
        )}

        {route.name === "sources" && isAdmin && (
          <SourcesListPage
            onBack={() => navigation.admin().push()}
            onNavigateToAddSource={() => navigation.addSource().push()}
            onNavigateToSourceDetail={(sourceId) =>
              navigation.sourceDetail(sourceId).push()
            }
          />
        )}

        {route.name === "addSource" && isAdmin && (
          <AddSourcePage onBack={() => navigation.sources().push()} />
        )}

        {route.name === "sourceDetail" && isAdmin && (
          <SourceDetailPage
            sourceId={route.params.sourceId}
            onBack={() => navigation.sources().push()}
          />
        )}

        {/* Handle invalid routes for authenticated users */}
        {route.name === false && (
          <Center style={{ minHeight: "50vh" }}>
            <Stack align="center" gap="md">
              <Title order={3}>Page not found</Title>
              <Text c="dimmed">The page you're looking for doesn't exist.</Text>
              <Button {...navigation.dashboard().link}>Go to Dashboard</Button>
            </Stack>
          </Center>
        )}

        {/* Handle admin-only routes for non-admin users */}
        {(route.name === "admin" ||
          route.name === "eventDebug" ||
          route.name === "subscriptionDebug" ||
          route.name === "workpoolDebug" ||
          route.name === "sources" ||
          route.name === "addSource" ||
          route.name === "sourceDetail") &&
          !isAdmin && (
            <Center style={{ minHeight: "50vh" }}>
              <Stack align="center" gap="md">
                <Title order={3}>Access Denied</Title>
                <Text c="dimmed">
                  You don't have permission to access this page.
                </Text>
                <Button {...navigation.dashboard().link}>
                  Go to Dashboard
                </Button>
              </Stack>
            </Center>
          )}
      </Container>
    </div>
  );
}
