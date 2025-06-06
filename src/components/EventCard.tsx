import { Doc } from "../../convex/_generated/dataModel";
import { Card, Image, Title, Text, Group, Button, Stack } from "@mantine/core";
import { IconCalendar } from "@tabler/icons-react";

interface EventCardProps {
  event: Doc<"events">;
  onClick: () => void;
  onDebugClick?: () => void;
  showDebugButton?: boolean;
}

export function EventCard({
  event,
  onClick,
  onDebugClick,
  showDebugButton,
}: EventCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ height: "100%" }}
    >
      <Card.Section>
        {event.imageUrl && (
          <Image
            src={event.imageUrl}
            alt={event.title}
            height={192}
            style={{ cursor: "pointer" }}
            onClick={onClick}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
      </Card.Section>

      <Stack gap="sm" style={{ height: "100%" }}>
        <Title
          order={3}
          size="lg"
          lineClamp={2}
          style={{ cursor: "pointer" }}
          onClick={onClick}
        >
          {event.title}
        </Title>

        <Group gap="xs" align="center">
          <IconCalendar size={16} />
          <Text size="sm" c="dimmed">
            {formatDate(event.eventDate)} at {formatTime(event.eventDate)}
          </Text>
        </Group>

        <Text size="sm" c="dimmed" lineClamp={3} style={{ flex: 1 }}>
          {event.description}
        </Text>

        <Group gap="xs" style={{ marginTop: "auto" }}>
          <Button onClick={onClick} style={{ flex: 1 }}>
            View Details
          </Button>

          {showDebugButton && onDebugClick && (
            <Button
              onClick={onDebugClick}
              color="yellow"
              title="Debug Event"
              style={{ minWidth: "auto" }}
            >
              🔧
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
