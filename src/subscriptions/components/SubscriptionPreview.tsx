import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatEventDateFriendly } from "../../utils/dateUtils";
import { EventDescription } from "../../events/EventDescription";
import {
  Title,
  Text,
  Card,
  Stack,
  Group,
  Badge,
  Loader,
  Center,
  Box,
  Image,
  SimpleGrid,
  Divider,
} from "@mantine/core";
import { IconCalendar } from "@tabler/icons-react";

type PreviewEvent = {
  _id: Id<"events">;
  title: string;
  description: string;
  eventDate: number;
  imageUrl?: string;
  score: number;
  matchType: "semantic" | "title";
  meetsThreshold?: boolean;
  thresholdValue?: number;
};

interface SubscriptionPreviewProps {
  prompt: string;
  onError?: (error: any) => void;
}

export function SubscriptionPreview({
  prompt,
  onError,
}: SubscriptionPreviewProps) {
  const [debouncedPrompt, setDebouncedPrompt] = useState("");
  const [previewEvents, setPreviewEvents] = useState<PreviewEvent[] | null>(
    null,
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const previewMatchingEvents = useAction(
    api.subscriptions.subscriptionsMatching.previewMatchingEvents,
  );

  // Debounce the prompt for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPrompt(prompt);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [prompt]);

  // Load preview events when debounced prompt changes
  useEffect(() => {
    if (!debouncedPrompt.trim()) {
      setPreviewEvents(null);
      return;
    }

    setIsLoadingPreview(true);
    previewMatchingEvents({ prompt: debouncedPrompt })
      .then((events) => setPreviewEvents(events))
      .catch((error) => {
        console.error("Error loading preview events:", error);
        setPreviewEvents([]);
        onError?.(error);
      })
      .finally(() => setIsLoadingPreview(false));
  }, [debouncedPrompt, previewMatchingEvents, onError]);

  const getScoreColor = (score: number, meetsThreshold?: boolean) => {
    if (!meetsThreshold) return "gray";
    if (score >= 0.8) return "green";
    if (score >= 0.6) return "yellow";
    return "red";
  };

  const getMatchTypeColor = (matchType: string, meetsThreshold?: boolean) => {
    if (!meetsThreshold) return "gray";
    if (matchType === "semantic") return "blue";
    return "grape";
  };

  const getCardOpacity = (meetsThreshold?: boolean) => {
    return meetsThreshold ? 1 : 0.6;
  };

  // Don't render anything if no prompt
  if (!debouncedPrompt.trim()) {
    return null;
  }

  // Separate events into those that meet threshold and those that don't
  const eventsAboveThreshold =
    previewEvents?.filter((event) => event.meetsThreshold) || [];
  const eventsBelowThreshold =
    previewEvents?.filter((event) => !event.meetsThreshold) || [];

  return (
    <Box>
      <Divider />
      <Box mt="xl">
        <Title order={3} mb="md">
          Preview: Events matching your interests
        </Title>
        <Text size="sm" c="dimmed" mb="lg">
          Here's a sample of events that match your description (with match
          scores):
        </Text>

        {isLoadingPreview ? (
          <Center py="xl">
            <Group gap="xs">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Finding matching events...
              </Text>
            </Group>
          </Center>
        ) : previewEvents === null ? (
          <Card
            bg="gray.0"
            padding="xl"
            radius="lg"
            style={{ textAlign: "center" }}
          >
            <Text size="2rem" mb="sm">
              ⏳
            </Text>
            <Text c="dimmed">Loading preview...</Text>
          </Card>
        ) : previewEvents.length === 0 ? (
          <Card
            bg="gray.0"
            padding="xl"
            radius="lg"
            style={{ textAlign: "center" }}
          >
            <Text size="2rem" mb="sm">
              🔍
            </Text>
            <Text c="dimmed" mb="xs">
              No events found matching this description
            </Text>
            <Text size="sm" c="dimmed">
              Try adjusting your prompt or check back later for new events
            </Text>
          </Card>
        ) : (
          <Stack gap="xl">
            {/* Events Above Threshold */}
            {eventsAboveThreshold.length > 0 && (
              <Box>
                <Group gap="xs" mb="md">
                  <Box
                    w={12}
                    h={12}
                    bg="green.5"
                    style={{ borderRadius: "50%" }}
                  />
                  <Text fw={500} size="md">
                    Events that will trigger notifications (
                    {eventsAboveThreshold.length})
                  </Text>
                </Group>
                <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
                  {eventsAboveThreshold.map((event: PreviewEvent) => (
                    <Card
                      key={event._id}
                      withBorder
                      padding="md"
                      radius="md"
                      style={{
                        opacity: getCardOpacity(event.meetsThreshold),
                      }}
                    >
                      {event.imageUrl && (
                        <Card.Section>
                          <Image
                            src={event.imageUrl}
                            alt={event.title}
                            height={128}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </Card.Section>
                      )}
                      <Stack gap="xs" mt="sm">
                        <Group gap="xs">
                          <Badge
                            color={getScoreColor(
                              event.score,
                              event.meetsThreshold,
                            )}
                            size="xs"
                          >
                            Score: {event.score.toFixed(3)}
                          </Badge>
                          <Badge
                            color={getMatchTypeColor(
                              event.matchType,
                              event.meetsThreshold,
                            )}
                            size="xs"
                          >
                            {event.matchType}
                          </Badge>
                        </Group>
                        <Text fw={500} size="sm" lineClamp={2}>
                          {event.title}
                        </Text>
                        <Group gap="xs" align="center">
                          <IconCalendar size={12} />
                          <Text size="xs" c="dimmed">
                            {formatEventDateFriendly(event.eventDate)}
                          </Text>
                        </Group>
                        <EventDescription
                          description={event.description}
                          maxLines={3}
                          size="xs"
                          c="dimmed"
                        />
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              </Box>
            )}

            {/* Events Below Threshold */}
            {eventsBelowThreshold.length > 0 && (
              <Box>
                <Group gap="xs" mb="md">
                  <Box
                    w={12}
                    h={12}
                    bg="gray.4"
                    style={{ borderRadius: "50%" }}
                  />
                  <Text fw={500} size="md" c="dimmed">
                    Below relevance threshold - won't trigger notifications (
                    {eventsBelowThreshold.length})
                  </Text>
                </Group>
                <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
                  {eventsBelowThreshold.map((event: PreviewEvent) => (
                    <Card
                      key={event._id}
                      withBorder
                      padding="md"
                      radius="md"
                      bg="gray.0"
                      style={{
                        opacity: getCardOpacity(event.meetsThreshold),
                      }}
                    >
                      {event.imageUrl && (
                        <Card.Section>
                          <Image
                            src={event.imageUrl}
                            alt={event.title}
                            height={128}
                            style={{ filter: "grayscale(100%)" }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </Card.Section>
                      )}
                      <Stack gap="xs" mt="sm">
                        <Group gap="xs">
                          <Badge
                            color={getScoreColor(
                              event.score,
                              event.meetsThreshold,
                            )}
                            size="xs"
                          >
                            Score: {event.score.toFixed(3)}
                          </Badge>
                          <Badge
                            color={getMatchTypeColor(
                              event.matchType,
                              event.meetsThreshold,
                            )}
                            size="xs"
                          >
                            {event.matchType}
                          </Badge>
                          <Badge color="red" size="xs">
                            Below {event.thresholdValue}
                          </Badge>
                        </Group>
                        <Text fw={500} size="sm" c="dimmed" lineClamp={2}>
                          {event.title}
                        </Text>
                        <Group gap="xs" align="center">
                          <IconCalendar size={12} />
                          <Text size="xs" c="dimmed">
                            {formatEventDateFriendly(event.eventDate)}
                          </Text>
                        </Group>
                        <EventDescription
                          description={event.description}
                          maxLines={3}
                          size="xs"
                          c="dimmed"
                        />
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              </Box>
            )}
          </Stack>
        )}

        {previewEvents && previewEvents.length > 0 && (
          <Card bg="blue.0" padding="md" radius="md" mt="lg">
            <Text size="sm" c="blue.8">
              💡{" "}
              <Text span fw={500}>
                Found {eventsAboveThreshold.length} relevant events
              </Text>{" "}
              that will trigger notifications.
              {eventsBelowThreshold.length > 0 && (
                <Text span>
                  {" "}
                  {eventsBelowThreshold.length} additional events are shown but
                  fall below the relevance threshold.
                </Text>
              )}
            </Text>
          </Card>
        )}
      </Box>
    </Box>
  );
}
