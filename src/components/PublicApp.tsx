import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { EventGallery } from "./EventGallery";
import { EventDetailPage } from "./EventDetailPage";
import { Id } from "../../convex/_generated/dataModel";
import {
  Container,
  Group,
  Button,
  Paper,
  Title,
  Text,
  Center,
  Stack,
} from "@mantine/core";

type Page = "home" | "event-detail" | "login";

interface PublicAppProps {
  onNavigateToLogin: () => void;
}

export function PublicApp({ onNavigateToLogin }: PublicAppProps) {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [selectedEventId, setSelectedEventId] = useState<Id<"events"> | null>(
    null,
  );

  const navigateToHome = () => {
    setCurrentPage("home");
    setSelectedEventId(null);
  };

  const navigateToEventDetail = (eventId: Id<"events">) => {
    setSelectedEventId(eventId);
    setCurrentPage("event-detail");
  };

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
              onClick={navigateToHome}
              color="gray"
              style={{ fontWeight: "bold", fontSize: "1.25rem" }}
            >
              EventFinder
            </Button>

            <Button onClick={onNavigateToLogin} size="md">
              Sign In
            </Button>
          </Group>
        </Container>
      </Paper>

      <Container size="xl" py="xl">
        {currentPage === "home" && (
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
                  onClick={onNavigateToLogin}
                  size="lg"
                  style={{ fontSize: "1.125rem" }}
                >
                  Get Started - Sign In
                </Button>
              </Stack>
            </Center>

            <EventGallery onEventClick={navigateToEventDetail} />
          </Stack>
        )}

        {currentPage === "event-detail" && selectedEventId && (
          <EventDetailPage eventId={selectedEventId} onBack={navigateToHome} />
        )}
      </Container>
    </div>
  );
}
