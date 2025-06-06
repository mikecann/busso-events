import { useState, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Badge,
  Textarea,
  Loader,
  Center,
  Box,
  Image,
  SimpleGrid,
  Divider,
} from "@mantine/core";
import { IconArrowLeft, IconCalendar } from "@tabler/icons-react";

interface CreateSubscriptionPageProps {
  onBack: () => void;
}

export function CreateSubscriptionPage({
  onBack,
}: CreateSubscriptionPageProps) {
  const createSubscription = useMutation(api.subscriptions.create);
  const previewMatchingEvents = useAction(
    api.subscriptionMatching.previewMatchingEvents,
  );

  const [prompt, setPrompt] = useState("");
  const [debouncedPrompt, setDebouncedPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewEvents, setPreviewEvents] = useState<any[] | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

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

    const loadPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const events = await previewMatchingEvents({ prompt: debouncedPrompt });
        setPreviewEvents(events);
      } catch (error) {
        console.error("Error loading preview events:", error);
        setPreviewEvents([]);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadPreview();
  }, [debouncedPrompt, previewMatchingEvents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsSubmitting(true);

    try {
      await createSubscription({
        prompt: prompt.trim(),
        isActive: true,
      });
      toast.success("Subscription created successfully!");
      onBack();
    } catch (error) {
      toast.error("Failed to create subscription");
      console.error("Error creating subscription:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatEventDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const getScoreColor = (score: number, meetsThreshold: boolean) => {
    if (!meetsThreshold) return "gray";
    if (score >= 0.8) return "green";
    if (score >= 0.6) return "yellow";
    return "red";
  };

  const getMatchTypeColor = (matchType: string, meetsThreshold: boolean) => {
    if (!meetsThreshold) return "gray";
    if (matchType === "semantic") return "blue";
    return "grape";
  };

  const getCardOpacity = (meetsThreshold: boolean) => {
    return meetsThreshold ? 1 : 0.6;
  };

  // Separate events into those that meet threshold and those that don't
  const eventsAboveThreshold =
    previewEvents?.filter((event) => event.meetsThreshold) || [];
  const eventsBelowThreshold =
    previewEvents?.filter((event) => !event.meetsThreshold) || [];

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={onBack}
          style={{ alignSelf: "flex-start" }}
        >
          Back to Subscriptions
        </Button>

        <Box>
          <Title order={1} size="2.5rem">
            Create Event Subscription
          </Title>
          <Text c="dimmed" mt="xs">
            Get notified about events that match your interests
          </Text>
        </Box>

        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <form onSubmit={handleSubmit}>
            <Stack gap="lg">
              <Box>
                <Text fw={500} size="sm" mb="xs">
                  What kind of events are you interested in?
                </Text>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., AI and machine learning conferences, startup networking events, tech talks about web development..."
                  rows={4}
                  required
                  autosize
                />
                <Text size="sm" c="dimmed" mt="xs">
                  Describe the types of events you'd like to be notified about.
                  Be as specific or general as you'd like.
                </Text>
              </Box>

              {/* Preview Section */}
              {debouncedPrompt.trim() && (
                <Box>
                  <Divider />
                  <Box mt="xl">
                    <Title order={3} mb="md">
                      Preview: Events matching your interests
                    </Title>
                    <Text size="sm" c="dimmed" mb="lg">
                      Here's a sample of events that match your description
                      (with match scores):
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
                          Try adjusting your prompt or check back later for new
                          events
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
                            <SimpleGrid
                              cols={{ base: 1, md: 2, lg: 3 }}
                              spacing="md"
                            >
                              {eventsAboveThreshold.map((event: any) => (
                                <Card
                                  key={event._id}
                                  withBorder
                                  padding="md"
                                  radius="md"
                                  style={{
                                    opacity: getCardOpacity(
                                      event.meetsThreshold,
                                    ),
                                  }}
                                >
                                  {event.imageUrl && (
                                    <Card.Section>
                                      <Image
                                        src={event.imageUrl}
                                        alt={event.title}
                                        height={128}
                                        onError={(e) => {
                                          e.currentTarget.style.display =
                                            "none";
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
                                        {formatEventDate(event.eventDate)}
                                      </Text>
                                    </Group>
                                    <Text size="xs" c="dimmed" lineClamp={3}>
                                      {event.description}
                                    </Text>
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
                                Below relevance threshold - won't trigger
                                notifications ({eventsBelowThreshold.length})
                              </Text>
                            </Group>
                            <SimpleGrid
                              cols={{ base: 1, md: 2, lg: 3 }}
                              spacing="md"
                            >
                              {eventsBelowThreshold.map((event: any) => (
                                <Card
                                  key={event._id}
                                  withBorder
                                  padding="md"
                                  radius="md"
                                  bg="gray.0"
                                  style={{
                                    opacity: getCardOpacity(
                                      event.meetsThreshold,
                                    ),
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
                                          e.currentTarget.style.display =
                                            "none";
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
                                    <Text
                                      fw={500}
                                      size="sm"
                                      c="dimmed"
                                      lineClamp={2}
                                    >
                                      {event.title}
                                    </Text>
                                    <Group gap="xs" align="center">
                                      <IconCalendar size={12} />
                                      <Text size="xs" c="dimmed">
                                        {formatEventDate(event.eventDate)}
                                      </Text>
                                    </Group>
                                    <Text size="xs" c="dimmed" lineClamp={3}>
                                      {event.description}
                                    </Text>
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
                              {eventsBelowThreshold.length} additional events
                              are shown but fall below the relevance threshold.
                            </Text>
                          )}
                        </Text>
                      </Card>
                    )}
                  </Box>
                </Box>
              )}

              <Group justify="space-between" pt="md">
                <Button
                  type="button"
                  onClick={onBack}
                  variant="default"
                  size="lg"
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || !prompt.trim()}
                  size="lg"
                  style={{ flex: 1 }}
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Subscription"}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
}
