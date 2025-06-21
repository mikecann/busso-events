import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { useAPIErrorHandler } from "../../../utils/hooks";
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Badge,
  Box,
  Stack,
  TextInput,
  Alert,
} from "@mantine/core";
import {
  IconSearch,
  IconBrain,
  IconCheck,
  IconX,
  IconAlertCircle,
} from "@tabler/icons-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface DebugSectionProps {
  eventId: Id<"events">;
}

export function SearchTest({ eventId }: DebugSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const enhancedSearch = useAction(api.events.events.enhancedSearch);
  const onApiError = useAPIErrorHandler();

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await enhancedSearch({
        searchTerm: searchTerm.trim(),
        dateFilter: "all",
      });

      setSearchResults(results);

      // Check if current event is in results
      const eventFound = results.some((event: any) => event._id === eventId);
      const currentEventInResults = results.find(
        (event: any) => event._id === eventId,
      );

      if (eventFound) {
        toast.success(
          `✅ Event found in search results! ${currentEventInResults?._searchType ? `(${currentEventInResults._searchType} search)` : ""}`,
        );
      } else {
        toast.error("❌ Event not found in search results");
      }
    } catch (error) {
      console.error("Search test failed:", error);
      setSearchError("Search test failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const currentEventInResults = searchResults?.find(
    (event: any) => event._id === eventId,
  );
  const isEventFound = !!currentEventInResults;
  const isSemanticSearch = searchTerm.trim().length > 3;

  return (
    <Card shadow="sm" padding="xl" radius="lg" withBorder>
      <Group justify="space-between" align="center" mb="lg">
        <Title order={2}>Search Test</Title>
        <Badge
          color={isSemanticSearch ? "blue" : "gray"}
          leftSection={
            isSemanticSearch ? (
              <IconBrain size={12} />
            ) : (
              <IconSearch size={12} />
            )
          }
        >
          {isSemanticSearch ? "AI + Text Search" : "Text Search Only"}
        </Badge>
      </Group>

      <Stack gap="md">
        <Group gap="sm">
          <TextInput
            placeholder="Enter search term to test..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            style={{ flex: 1 }}
            leftSection={<IconSearch size={16} />}
          />
          <Button
            onClick={handleSearch}
            loading={isSearching}
            disabled={!searchTerm.trim() || isSearching}
          >
            {isSearching ? "Searching..." : "Test Search"}
          </Button>
        </Group>

        {searchError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {searchError}
          </Alert>
        )}

        {searchResults && (
          <Card bg="gray.0" padding="md" radius="md">
            <Group justify="space-between" align="center" mb="sm">
              <Text fw={500} size="sm">
                Search Results: {searchResults.length} events found
              </Text>
              <Badge
                color={isEventFound ? "green" : "red"}
                leftSection={
                  isEventFound ? <IconCheck size={12} /> : <IconX size={12} />
                }
              >
                {isEventFound ? "Event Found" : "Event Not Found"}
              </Badge>
            </Group>

            {isEventFound && currentEventInResults && (
              <Box
                p="sm"
                bg="green.0"
                style={{
                  borderRadius: "6px",
                  border: "1px solid var(--mantine-color-green-3)",
                }}
              >
                <Group justify="space-between" align="center">
                  <Text size="sm" fw={500} c="green.8">
                    ✅ This event appears in search results
                  </Text>
                  <Group gap="xs">
                    {currentEventInResults._searchType && (
                      <Badge size="sm" color="green" variant="light">
                        {currentEventInResults._searchType}
                      </Badge>
                    )}
                    {currentEventInResults._score && (
                      <Badge size="sm" color="blue" variant="light">
                        Score: {currentEventInResults._score.toFixed(3)}
                      </Badge>
                    )}
                  </Group>
                </Group>
              </Box>
            )}

            {!isEventFound && searchResults.length > 0 && (
              <Box
                p="sm"
                bg="red.0"
                style={{
                  borderRadius: "6px",
                  border: "1px solid var(--mantine-color-red-3)",
                }}
              >
                <Text size="sm" fw={500} c="red.8">
                  ❌ This event does not appear in the search results
                </Text>
                <Text size="xs" c="red.6" mt="xs">
                  Try different search terms or check if the event content
                  matches what users might search for.
                </Text>
              </Box>
            )}

            {searchResults.length === 0 && (
              <Box
                p="sm"
                bg="yellow.0"
                style={{
                  borderRadius: "6px",
                  border: "1px solid var(--mantine-color-yellow-3)",
                }}
              >
                <Text size="sm" fw={500} c="yellow.8">
                  ⚠️ No events found for this search term
                </Text>
              </Box>
            )}
          </Card>
        )}

        <Card bg="violet.0" padding="md" radius="md">
          <Text size="sm" c="violet.8">
            🔍{" "}
            <Text span fw={500}>
              Search Test
            </Text>{" "}
            uses the same search logic as the main dashboard. It combines text
            search (title and description) with AI-powered semantic search for
            longer queries (4+ characters). This helps you understand if users
            will find this event when searching.
          </Text>
        </Card>
      </Stack>
    </Card>
  );
}
