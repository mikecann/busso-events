import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useMemo, useEffect } from "react";
import { EventCard } from "../events/EventCard";
import { SearchBar } from "./SearchBar";
import { DateFilter } from "./DateFilter";
import { Id, Doc } from "../../convex/_generated/dataModel";
import {
  Stack,
  Group,
  Loader,
  Center,
  Text,
  Card,
  Title,
  SimpleGrid,
  Alert,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconInfoCircle } from "@tabler/icons-react";

interface EventGalleryProps {
  onEventClick: (eventId: Id<"events">) => void;
}

export function EventGallery({ onEventClick }: EventGalleryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "week" | "month" | "3months"
  >("all");
  const [events, setEvents] = useState<Doc<"events">[] | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounce search term to prevent queries on every keystroke
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);

  const enhancedSearch = useAction(api.events.events.enhancedSearch);

  // Use fallback query for empty search terms
  const fallbackEvents = useQuery(api.events.events.search, {
    searchTerm: "",
    dateFilter,
  });

  useEffect(() => {
    const performSearch = async () => {
      setSearchError(null);

      if (debouncedSearchTerm.trim() === "") {
        // Use fallback query for empty search
        setEvents(fallbackEvents);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await enhancedSearch({
          searchTerm: debouncedSearchTerm.trim(),
          dateFilter,
        });
        setEvents(results);
      } catch (error) {
        console.error("Enhanced search failed:", error);
        setSearchError("Search failed. Please try again.");
        // Fallback to basic search if enhanced search fails
        try {
          const basicResults = await enhancedSearch({
            searchTerm: debouncedSearchTerm.trim(),
            dateFilter,
          });
          setEvents(basicResults);
          setSearchError("Using basic search (semantic search unavailable)");
        } catch (fallbackError) {
          console.error("Fallback search also failed:", fallbackError);
          setEvents([]);
        }
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm, dateFilter, enhancedSearch, fallbackEvents]);

  if (events === undefined) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  const isSemanticSearch = debouncedSearchTerm.trim().length > 3;

  return (
    <Stack gap="lg">
      <Group align="flex-start" gap="md" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "300px" }}>
          <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        </div>
        <DateFilter value={dateFilter} onChange={setDateFilter} />
      </Group>

      {searchError && (
        <Alert icon={<IconInfoCircle size="1rem" />} color="yellow">
          {searchError}
        </Alert>
      )}

      {isSearching && (
        <Center py="md">
          <Group>
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              {isSemanticSearch ? "Searching with AI..." : "Searching..."}
            </Text>
          </Group>
        </Center>
      )}

      {!isSearching && events.length === 0 ? (
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
              ? "Try adjusting your search terms or use different keywords"
              : "Check back later for new events"}
          </Text>
        </Card>
      ) : (
        !isSearching && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {events.map((event: Doc<"events">) => (
              <EventCard
                key={event._id}
                event={event}
                onClick={() => onEventClick(event._id)}
              />
            ))}
          </SimpleGrid>
        )
      )}
    </Stack>
  );
}
