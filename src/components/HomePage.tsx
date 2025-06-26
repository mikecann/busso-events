import { EventGallery } from "./EventGallery";
import { navigation } from "../router";
import {
  Container,
  Group,
  Button,
  Paper,
  Stack,
  Title,
  Text,
  Center,
} from "@mantine/core";

export function HomePage() {
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
              <Text size="xl" c="dimmed" style={{ marginBottom: "2rem" }}>
                All the events for Busselton and the south west, aggregated in
                one place
              </Text>
            </Stack>
          </Center>
          <EventGallery
            onEventClick={(eventId) => navigation.eventDetail(eventId).push()}
          />
        </Stack>
      </Container>
    </div>
  );
}
