import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatEventDate } from "../utils/dateUtils";
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
  eventId: string;
  onBack: () => void;
  onDebugClick?: () => void;
}

export function EventDetailPage({
  eventId,
  onBack,
  onDebugClick,
}: EventDetailPageProps) {
  const event = useQuery(api.events.getById, { id: eventId as Id<"events"> });

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

          <Stack gap="md" p="xl">
            <Title order={1} size="h2">
              {event.title}
            </Title>

            <Text size="lg" c="dimmed">
              {event.description}
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl" mt="md">
              <Group gap="xs">
                <IconCalendar size={20} color="var(--mantine-color-blue-6)" />
                <Box>
                  <Text fw={500} size="sm" c="dimmed">
                    Event Date
                  </Text>
                  <Text size="lg">{formatEventDate(event.eventDate)}</Text>
                </Box>
              </Group>

              {event.url && (
                <Text
                  component="a"
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  c="blue.6"
                  style={{ textDecoration: "none" }}
                >
                  <Group gap="xs">
                    <IconExternalLink size={20} />
                    <Box>
                      <Text fw={500} size="sm" c="dimmed">
                        Original Event
                      </Text>
                      <Text size="lg" c="blue.6">
                        View on Website
                      </Text>
                    </Box>
                  </Group>
                </Text>
              )}
            </SimpleGrid>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
