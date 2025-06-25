import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { EventCard } from "../events/EventCard";
import { SearchBar } from "./SearchBar";
import { DateFilter } from "./DateFilter";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { useAPIErrorHandler } from "../utils/hooks";
import {
  Stack,
  Group,
  Loader,
  Center,
  Text,
  Card,
  Title,
  SimpleGrid,
  Button,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";

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
  const [paginationCursor, setPaginationCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const enhancedSearch = useAction(api.events.events.enhancedSearch);
  const onApiError = useAPIErrorHandler();

  const fallbackEventsResult = useQuery(api.events.events.listByDate, {
    paginationOpts: { numItems: 9, cursor: paginationCursor },
    dateFilter,
  });

  const fallbackEvents = fallbackEventsResult?.page;
  const hasMore = fallbackEventsResult?.isDone === false;

  useEffect(() => {
    if (debouncedSearchTerm.trim() === "") {
      if (paginationCursor === null) {
        // First page load or filter change
        setEvents(fallbackEvents);
      } else if (fallbackEvents && events) {
        // Loading more results - append to existing
        setEvents([...events, ...fallbackEvents]);
        setIsLoadingMore(false);
      }
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    enhancedSearch({
      searchTerm: debouncedSearchTerm.trim(),
      dateFilter,
    })
      .then(setEvents)
      .catch(onApiError)
      .finally(() => setIsSearching(false));
  }, [
    debouncedSearchTerm,
    dateFilter,
    enhancedSearch,
    fallbackEvents,
    onApiError,
    paginationCursor,
    events,
  ]);

  // Reset pagination when date filter changes
  useEffect(() => {
    setPaginationCursor(null);
    setEvents(undefined);
  }, [dateFilter]);

  const loadMore = () => {
    if (!hasMore || isLoadingMore || debouncedSearchTerm.trim() !== "") return;

    setIsLoadingMore(true);
    setPaginationCursor(fallbackEventsResult?.continueCursor || null);
  };

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
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {events.map((event) => (
                <EventCard
                  key={event._id}
                  event={event}
                  onClick={() => onEventClick(event._id)}
                />
              ))}
            </SimpleGrid>

            {/* Load More Button - only show when not searching and there are more results */}
            {debouncedSearchTerm.trim() === "" && hasMore && (
              <Center py="md">
                <Button
                  onClick={loadMore}
                  loading={isLoadingMore}
                  variant="light"
                  size="md"
                >
                  {isLoadingMore ? "Loading..." : "Load More"}
                </Button>
              </Center>
            )}
          </>
        )
      )}
    </Stack>
  );
}
