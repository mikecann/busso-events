import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { EventDetailPage } from "./EventDetailPage";
import { navigation } from "../router";
import { Container, Group, Button, Paper } from "@mantine/core";
import { Id } from "../../convex/_generated/dataModel";

interface EventDetailPublicProps {
  eventId: string;
}

export function EventDetailPublic({ eventId }: EventDetailPublicProps) {
  const isAdmin = useQuery(api.users.isCurrentUserAdmin);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
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
    </div>
  );
}
