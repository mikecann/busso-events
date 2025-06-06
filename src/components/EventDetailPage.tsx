import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Container,
  Card,
  Image,
  Title,
  Text,
  Group,
  Button,
  Stack,
  Loader,
  Center,
  SimpleGrid,
  Box,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconCalendar,
  IconExternalLink,
} from "@tabler/icons-react";

interface EventDetailPageProps {
  eventId: Id<"events">;
  onBack: () => void;
  onDebugClick?: () => void;
}

export function EventDetailPage({
  eventId,
  onBack,
  onDebugClick,
}: EventDetailPageProps) {
  const event = useQuery(api.events.getById, { id: eventId });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  };

  if (event === undefined) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  if (event === null) {
    return (
      <Center py="xl" style={{ textAlign: "center" }}>
        <Stack gap="md">
          <Title order={3}>Event not found</Title>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="subtle"
            onClick={onBack}
          >
            Back to Events
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group gap="md">
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="subtle"
            onClick={onBack}
          >
            Back to Events
          </Button>

          {onDebugClick && (
            <Button onClick={onDebugClick} color="yellow">
              🔧 Debug Event
            </Button>
          )}
        </Group>

        <Card shadow="sm" radius="lg" withBorder>
          <Card.Section>
            {event.imageUrl && (
              <Image
                src={event.imageUrl}
                alt={event.title}
                height={300}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
          </Card.Section>

          <Stack gap="lg" p="xl">
            <Title order={1} size="2.5rem">
              {event.title}
            </Title>

            <Group gap="md">
              <Group gap="xs">
                <IconCalendar size={20} />
                <Text size="lg" c="dimmed">
                  {formatDate(event.eventDate)}
                </Text>
              </Group>
            </Group>

            <Text size="md" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {event.description}
            </Text>

            {event.scrapedData && (
              <Card withBorder radius="md" bg="gray.0">
                <Title order={3} mb="md">
                  Additional Details
                </Title>
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  {Object.entries(event.scrapedData).map(
                    ([key, value]) =>
                      value && (
                        <Box key={key}>
                          <Text fw={500} size="sm" mb={2}>
                            {key.replace(/([A-Z])/g, " $1").trim()}:
                          </Text>
                          <Text size="sm" c="dimmed">
                            {Array.isArray(value) ? value.join(", ") : value}
                          </Text>
                        </Box>
                      ),
                  )}
                </SimpleGrid>
              </Card>
            )}

            <Group gap="md">
              <Button
                component="a"
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                rightSection={<IconExternalLink size={16} />}
                size="lg"
              >
                View Original Event
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
