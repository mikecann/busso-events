import { Doc } from "../../convex/_generated/dataModel";
import { formatDateForCard, formatTime } from "../utils/dateUtils";
import {
  Card,
  Image,
  Title,
  Text,
  Group,
  Stack,
  Box,
  Badge,
} from "@mantine/core";
import { IconCalendar, IconMapPin } from "@tabler/icons-react";

interface EventCardProps {
  event: Doc<"events">;
  onClick: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const { month, day, weekday } = formatDateForCard(event.eventDate);
  const time = formatTime(event.eventDate);

  return (
    <Card
      shadow="md"
      padding={0}
      radius="lg"
      withBorder
      style={{
        height: "100%",
        cursor: "pointer",
        transition: "all 0.2s ease",
        background: "linear-gradient(135deg, #fff 0%, #f8f9fa 100%)",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.07)";
      }}
      onClick={onClick}
    >
      <Card.Section style={{ position: "relative" }}>
        {event.imageUrl ? (
          <Box style={{ position: "relative", overflow: "hidden" }}>
          <Image
            src={event.imageUrl}
            alt={event.title}
              height={200}
              style={{
                transition: "transform 0.3s ease",
              }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
            {/* Date overlay */}
            <Box
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
                borderRadius: "12px",
                padding: "8px 12px",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              }}
            >
              <Text
                size="xs"
                fw={600}
                c="blue.6"
                style={{ lineHeight: 1, marginBottom: 2 }}
              >
                {month.toUpperCase()}
              </Text>
              <Text size="lg" fw={700} c="dark" style={{ lineHeight: 1 }}>
                {day}
              </Text>
            </Box>
          </Box>
        ) : (
          // Gradient placeholder when no image
          <Box
            style={{
              height: 200,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <Text c="white" size="xl" fw={600} ta="center">
              {event.title.split(" ").slice(0, 2).join(" ")}
            </Text>
            {/* Date overlay for no-image case */}
            <Box
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
                borderRadius: "12px",
                padding: "8px 12px",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              }}
            >
              <Text
                size="xs"
                fw={600}
                c="blue.6"
                style={{ lineHeight: 1, marginBottom: 2 }}
              >
                {month.toUpperCase()}
              </Text>
              <Text size="lg" fw={700} c="dark" style={{ lineHeight: 1 }}>
                {day}
              </Text>
            </Box>
          </Box>
        )}
      </Card.Section>

      <Stack gap="md" p="lg" style={{ height: "100%" }}>
        <Stack gap="xs">
        <Title
          order={3}
            size="xl"
            fw={600}
          lineClamp={2}
            style={{
              lineHeight: 1.3,
              color: "#2c2e33",
            }}
        >
          {event.title}
        </Title>

        <Group gap="xs" align="center">
            <IconCalendar size={16} color="#868e96" />
            <Text size="sm" c="dimmed" fw={500}>
              {weekday}, {time}
          </Text>
        </Group>

          {event.scrapedData?.location && (
            <Group gap="xs" align="center">
              <IconMapPin size={16} color="#868e96" />
              <Text size="sm" c="dimmed" fw={500} lineClamp={1}>
                {event.scrapedData.location}
              </Text>
            </Group>
          )}
        </Stack>

        <Text
          size="sm"
          c="dimmed"
          lineClamp={3}
          style={{
            flex: 1,
            lineHeight: 1.5,
          }}
        >
          {event.description}
        </Text>

        <Group
          gap="xs"
          justify="space-between"
          align="center"
          style={{ marginTop: "auto" }}
        >
          {event.scrapedData?.price && (
            <Badge
              variant="light"
              color={
                event.scrapedData.price.toLowerCase().includes("free")
                  ? "green"
                  : "blue"
              }
              radius="md"
              style={{ textTransform: "none" }}
            >
              {event.scrapedData.price}
            </Badge>
          )}

          {event.scrapedData?.category && (
            <Badge
              variant="outline"
              color="gray"
              radius="md"
              style={{ textTransform: "capitalize" }}
            >
              {event.scrapedData.category}
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
