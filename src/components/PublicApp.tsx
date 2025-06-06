import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { EventGallery } from "./EventGallery";
import { EventDetailPage } from "./EventDetailPage";
import { SignInForm } from "../SignInForm";
import { useRoute, navigation } from "../router";
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

export function PublicApp() {
  const route = useRoute();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      <Paper
        shadow="xs"
        withBorder
        style={{ borderTop: "none", borderLeft: "none", borderRight: "none" }}
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
        {route.name === "home" && (
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
                  Discover Amazing Events
                </Title>
                <Text size="xl" c="dimmed" style={{ marginBottom: "2rem" }}>
                  Find events that match your interests and never miss out
                </Text>
                <Button
                  {...navigation.login().link}
                  size="lg"
                  style={{ fontSize: "1.125rem" }}
                >
                  Get Started - Sign In
                </Button>
              </Stack>
            </Center>

            <EventGallery
              onEventClick={(eventId) => navigation.eventDetail(eventId).push()}
            />
          </Stack>
        )}

        {route.name === "eventDetail" && (
          <EventDetailPage
            eventId={route.params.eventId}
            onBack={() => navigation.home().push()}
          />
        )}

        {route.name === "login" && (
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
                <Button variant="subtle" size="sm" {...navigation.home().link}>
                  ← Back to browse events
                </Button>
              </Stack>
            </Card>
          </Center>
        )}

        {route.name === false && (
          <Center style={{ minHeight: "50vh" }}>
            <Stack align="center" gap="md">
              <Title order={3}>Page not found</Title>
              <Text c="dimmed">The page you're looking for doesn't exist.</Text>
              <Button {...navigation.home().link}>Go to Home</Button>
            </Stack>
          </Center>
        )}
      </Container>
    </div>
  );
}
