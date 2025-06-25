import { useQuery, useAction, usePaginatedQuery } from "convex/react";
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
  const [searchEvents, setSearchEvents] = useState<Doc<"events">[] | undefined>(
    undefined,
  );
  const [isSearching, setIsSearching] = useState(false);

  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const enhancedSearch = useAction(api.events.events.enhancedSearch);
  const onApiError = useAPIErrorHandler();

  // Calculate date range once when dateFilter changes and keep it consistent
  const [dateRange, setDateRange] = useState(() => {
    const now = Date.now();
    const startDate = now;
    const endDate = now + 100 * 365 * 24 * 60 * 60 * 1000; // 100 years for "all"
    return { startDate, endDate };
  });

  // Update date range when filter changes
  useEffect(() => {
    const now = Date.now();
    const startDate = now;

    let endDate: number;
    switch (dateFilter) {
      case "week":
        endDate = now + 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        endDate = now + 30 * 24 * 60 * 60 * 1000;
        break;
      case "3months":
        endDate = now + 90 * 24 * 60 * 60 * 1000;
        break;
      default: // "all"
        endDate = now + 100 * 365 * 24 * 60 * 60 * 1000;
    }

    setDateRange({ startDate, endDate });
  }, [dateFilter]);

  // Use Convex's built-in pagination hook with fixed date range
  const {
    results: paginatedEvents,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.events.events.listByDate,
    { startDate: dateRange.startDate, endDate: dateRange.endDate },
    { initialNumItems: 9 },
  );

  // Determine which events to show based on search state
  const events =
    debouncedSearchTerm.trim() === "" ? paginatedEvents : searchEvents;

  useEffect(() => {
    if (debouncedSearchTerm.trim() === "") {
      setSearchEvents(undefined);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    enhancedSearch({
      searchTerm: debouncedSearchTerm.trim(),
      dateFilter,
    })
      .then(setSearchEvents)
      .catch(onApiError)
      .finally(() => setIsSearching(false));
  }, [debouncedSearchTerm, dateFilter, enhancedSearch, onApiError]);

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
            {debouncedSearchTerm.trim() === "" &&
              (paginationStatus === "CanLoadMore" ||
                paginationStatus === "LoadingMore") && (
                <Center py="md">
                  <Button
                    onClick={() => loadMore(9)}
                    loading={paginationStatus === "LoadingMore"}
                    disabled={paginationStatus === "LoadingMore"}
                    variant="light"
                    size="md"
                  >
                    {paginationStatus === "LoadingMore"
                      ? "Loading..."
                      : "Load More"}
                  </Button>
                </Center>
              )}
          </>
        )
      )}
    </Stack>
  );
}
