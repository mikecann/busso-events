import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, Title, Text, Box, SimpleGrid } from "@mantine/core";
import { DebugSectionProps } from "../types";

export function ScrapedData({ eventId }: DebugSectionProps) {
  const event = useQuery(api.events.events.getById, { id: eventId });

  if (!event || !event.scrapedData) return null;

  return (
    <Card shadow="sm" padding="xl" radius="lg" withBorder>
      <Title order={2} mb="lg">
        Scraped Data
      </Title>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {Object.entries(event.scrapedData).map(([key, value]) => (
          <Box key={key}>
            <Text
              fw={500}
              size="sm"
              c="gray.7"
              style={{ textTransform: "capitalize" }}
            >
              {key.replace(/([A-Z])/g, " $1").trim()}:
            </Text>
            <Text size="sm">
              {Array.isArray(value)
                ? value.join(", ")
                : String(value || "Not available")}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Card>
  );
}
