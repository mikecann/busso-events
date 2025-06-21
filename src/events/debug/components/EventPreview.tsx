import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { formatDateDetailed as formatDate } from "../../../utils/dateUtils";
import { Card, Title, Text, Group, Stack, Image } from "@mantine/core";
import { IconCalendar, IconExternalLink } from "@tabler/icons-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface DebugSectionProps {
  eventId: Id<"events">;
}

export function EventPreview({ eventId }: DebugSectionProps) {
  const event = useQuery(api.events.events.getById, { id: eventId });

  if (!event) return null;

  return (
    <Card shadow="sm" padding="xl" radius="lg" withBorder>
      <Title order={2} mb="lg">
        Event Preview
      </Title>
      <Card withBorder padding="lg" radius="md">
        {event.imageUrl && (
          <Card.Section>
            <Image
              src={event.imageUrl}
              alt={event.title}
              height={192}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </Card.Section>
        )}
        <Stack gap="md" mt={event.imageUrl ? "md" : 0}>
          <Title order={3} size="lg">
            {event.title}
          </Title>
          <Text c="dimmed">{event.description}</Text>
          <Group gap="lg">
            <Group gap="xs">
              <IconCalendar size={16} />
              <Text size="sm" c="dimmed">
                {formatDate(event.eventDate)}
              </Text>
            </Group>
            <Text
              component="a"
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              c="blue"
              style={{ textDecoration: "none" }}
            >
              <Group gap="xs">
                <span>View Event</span>
                <IconExternalLink size={12} />
              </Group>
            </Text>
          </Group>
        </Stack>
      </Card>
    </Card>
  );
}
