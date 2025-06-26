import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRoute, navigation } from "../router";
import { AuthRequired } from "./AuthRequired";
import { AdminRequired } from "./AdminRequired";
import { Header } from "./Header";
import { SignInForm } from "../SignInForm";
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
import {
  Container,
  Group,
  Button,
  Paper,
  Stack,
  Title,
  Text,
  Center,
  Card,
} from "@mantine/core";
import { Id } from "../../convex/_generated/dataModel";

function EventDetailComponent({ eventId }: { eventId: string }) {
  const isAdmin = useQuery(api.users.isCurrentUserAdmin);

  return (
    <>
      <Paper
        shadow="xs"
        withBorder
        style={{
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
        }}
      >
        <Container size="xl" py="md">
          <Group justify="space-between">
            <Button
              variant="subtle"
              size="lg"
              {...navigation.home().link}
              color="gray"
              style={{ fontWeight: "bold", fontSize: "1.25rem" }}
            >
              EventFinder
            </Button>
            <Button {...navigation.login().link} size="md">
              Sign In
            </Button>
          </Group>
        </Container>
      </Paper>
      <Container size="xl" py="xl">
        <EventDetailPage
          eventId={eventId}
          onBack={() => navigation.home().push()}
          onDebugClick={
            isAdmin
              ? () => navigation.eventDebug(eventId as Id<"events">).push()
              : undefined
          }
        />
      </Container>
    </>
  );
}

export function Routes() {
  const route = useRoute();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      {(() => {
        switch (route.name) {
          // Public routes - no auth required
          case "home":
            return (
              <>
                <Paper
                  shadow="xs"
                  withBorder
                  style={{
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                  }}
                >
                  <Container size="xl" py="md">
                    <Group justify="space-between">
                      <Button
                        variant="subtle"
                        size="lg"
                        {...navigation.home().link}
                        color="gray"
                        style={{ fontWeight: "bold", fontSize: "1.25rem" }}
                      >
                        EventFinder
                      </Button>
                      <Button {...navigation.login().link} size="md">
                        Sign In
                      </Button>
                    </Group>
                  </Container>
                </Paper>
                <Container size="xl" py="xl">
                  <Stack gap="xl">
                    <Center>
                      <Stack
                        gap="xl"
                        align="center"
                        style={{
                          textAlign: "center",
                          paddingTop: "2rem",
                          paddingBottom: "2rem",
                        }}
                      >
                        <Title order={1} size="3rem" fw={700}>
                          Busso Events
                        </Title>
                        <Text
                          size="xl"
                          c="dimmed"
                          style={{ marginBottom: "2rem" }}
                        >
                          All the events for Busselton and the south west,
                          aggregated in one place
                        </Text>
                      </Stack>
                    </Center>
                    <EventGallery
                      onEventClick={(eventId) =>
                        navigation.eventDetail(eventId).push()
                      }
                    />
                  </Stack>
                </Container>
              </>
            );

          case "login":
            return (
              <>
                <Paper
                  shadow="xs"
                  withBorder
                  style={{
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                  }}
                >
                  <Container size="xl" py="md">
                    <Group justify="space-between">
                      <Button
                        variant="subtle"
                        size="lg"
                        {...navigation.home().link}
                        color="gray"
                        style={{ fontWeight: "bold", fontSize: "1.25rem" }}
                      >
                        EventFinder
                      </Button>
                      <Button {...navigation.login().link} size="md">
                        Sign In
                      </Button>
                    </Group>
                  </Container>
                </Paper>
                <Container size="xl" py="xl">
                  <Center style={{ minHeight: "50vh" }}>
                    <Card
                      shadow="sm"
                      padding="xl"
                      radius="md"
                      withBorder
                      style={{ width: "100%", maxWidth: "400px" }}
                    >
                      <Stack align="center" gap="md">
                        <div style={{ textAlign: "center" }}>
                          <Title order={2} mb="xs">
                            Welcome to EventFinder
                          </Title>
                          <Text c="dimmed">
                            Sign in to manage your event subscriptions
                          </Text>
                        </div>
                        <SignInForm />
                        <Button
                          variant="subtle"
                          size="sm"
                          {...navigation.home().link}
                        >
                          ← Back to browse events
                        </Button>
                      </Stack>
                    </Card>
                  </Center>
                </Container>
              </>
            );

          // Public event detail - accessible without auth
          case "eventDetail":
            return <EventDetailComponent eventId={route.params.eventId} />;

          // Authenticated routes
          case "dashboard":
            return (
              <AuthRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <EventGallery
                    onEventClick={(eventId) =>
                      navigation.eventDetail(eventId).push()
                    }
                  />
                </Container>
              </AuthRequired>
            );

          case "subscriptions":
            return (
              <AuthRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <SubscriptionsPage
                    onCreateNew={() => navigation.createSubscription().push()}
                    onNavigateToSubscription={(subscriptionId) =>
                      navigation.subscriptionDetail(subscriptionId).push()
                    }
                  />
                </Container>
              </AuthRequired>
            );

          case "createSubscription":
            return (
              <AuthRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <CreateSubscriptionPage
                    onBack={() => navigation.subscriptions().push()}
                  />
                </Container>
              </AuthRequired>
            );

          case "subscriptionDetail":
            return (
              <AuthRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <SubscriptionDetailPage
                    subscriptionId={
                      route.params.subscriptionId as Id<"subscriptions">
                    }
                    onBack={() => navigation.subscriptions().push()}
                  />
                </Container>
              </AuthRequired>
            );

          // Admin routes
          case "admin":
            return (
              <AdminRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <AppAdminPage
                    onNavigateToSources={() => navigation.sources().push()}
                    onNavigateToSubscriptionDebug={() =>
                      navigation.subscriptionDebug().push()
                    }
                    onNavigateToWorkpoolDebug={(workpoolType) =>
                      navigation.workpoolDebug(workpoolType).push()
                    }
                  />
                </Container>
              </AdminRequired>
            );

          case "sources":
            return (
              <AdminRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <SourcesListPage
                    onBack={() => navigation.admin().push()}
                    onNavigateToAddSource={() => navigation.addSource().push()}
                    onNavigateToSourceDetail={(sourceId) =>
                      navigation.sourceDetail(sourceId).push()
                    }
                  />
                </Container>
              </AdminRequired>
            );

          case "addSource":
            return (
              <AdminRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <AddSourcePage onBack={() => navigation.sources().push()} />
                </Container>
              </AdminRequired>
            );

          case "sourceDetail":
            return (
              <AdminRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <SourceDetailPage
                    sourceId={route.params.sourceId}
                    onBack={() => navigation.sources().push()}
                  />
                </Container>
              </AdminRequired>
            );

          case "eventDebug":
            return (
              <AdminRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <EventDebugPage
                    eventId={route.params.eventId}
                    onBack={() => {
                      // Use browser history to go back to where we came from
                      window.history.back();
                    }}
                  />
                </Container>
              </AdminRequired>
            );

          case "subscriptionDebug":
            return (
              <AdminRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
                  <SubscriptionDebugPage
                    onBack={() => navigation.admin().push()}
                  />
                </Container>
              </AdminRequired>
            );

          case "workpoolDebug":
            return (
              <AdminRequired>
                <Header currentRoute={route.name} />
                <Container size="xl" py="xl">
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
                </Container>
              </AdminRequired>
            );

          // 404 route
          case false:
            return (
              <Container size="xl" py="xl">
                <Center style={{ minHeight: "50vh" }}>
                  <Stack align="center" gap="md">
                    <Title order={3}>Page not found</Title>
                    <Text c="dimmed">
                      The page you're looking for doesn't exist.
                    </Text>
                    <Button {...navigation.home().link}>Go to Home</Button>
                  </Stack>
                </Center>
              </Container>
            );

          // This should never happen if we handle all routes
          default:
            return (
              <Container size="xl" py="xl">
                <Center style={{ minHeight: "50vh" }}>
                  <Stack align="center" gap="md">
                    <Title order={3}>Unknown route</Title>
                    <Text c="dimmed">
                      This route is not handled by the application.
                    </Text>
                    <Button {...navigation.home().link}>Go to Home</Button>
                  </Stack>
                </Center>
              </Container>
            );
        }
      })()}
    </div>
  );
}
