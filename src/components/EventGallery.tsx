import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { EventCard } from "./EventCard";
import { SearchBar } from "./SearchBar";
import { DateFilter } from "./DateFilter";
import { Id } from "../../convex/_generated/dataModel";
import {
  Stack,
  Group,
  Loader,
  Center,
  Text,
  Card,
  Title,
  SimpleGrid,
} from "@mantine/core";

interface EventGalleryProps {
  onEventClick: (eventId: Id<"events">) => void;
  onEventDebugClick?: (eventId: Id<"events">) => void;
}

export function EventGallery({
  onEventClick,
  onEventDebugClick,
}: EventGalleryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "week" | "month" | "3months"
  >("all");

  const events = useQuery(api.events.search, {
    searchTerm: searchTerm.trim() || "",
    dateFilter,
  });

  if (events === undefined) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Group align="flex-start" gap="md" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "300px" }}>
          <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        </div>
        <DateFilter value={dateFilter} onChange={setDateFilter} />
      </Group>

      {events.length === 0 ? (
        <Card
          shadow="sm"
          padding="xl"
          radius="lg"
          style={{ textAlign: "center" }}
        >
          <Text size="4rem" style={{ marginBottom: "1rem" }}>
            🔍
          </Text>
          <Title order={3} mb="xs">
            No events found
          </Title>
          <Text c="dimmed">
            {searchTerm
              ? "Try adjusting your search terms"
              : "Check back later for new events"}
          </Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {events.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              onClick={() => onEventClick(event._id)}
              onDebugClick={
                onEventDebugClick
                  ? () => onEventDebugClick(event._id)
                  : undefined
              }
              showDebugButton={!!onEventDebugClick}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
