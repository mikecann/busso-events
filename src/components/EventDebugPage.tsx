import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
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
  TextInput,
  Textarea,
  Loader,
  Center,
  Box,
  Image,
  SimpleGrid,
  Divider,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconSearch,
  IconBrain,
  IconTrash,
  IconRefresh,
  IconCalendar,
  IconExternalLink,
} from "@tabler/icons-react";

interface EventDebugPageProps {
  eventId: string;
  onBack: () => void;
}

export function EventDebugPage({ eventId, onBack }: EventDebugPageProps) {
  const event = useQuery(api.events.getById, { id: eventId as any });
  const updateEvent = useMutation(api.eventsAdmin.updateEvent);
  const deleteEvent = useMutation(api.eventsAdmin.deleteEvent);
  const scrapeEvent = useAction(api.eventsAdmin.scrapeEvent);
  const generateEmbedding = useAction(api.embeddings.generateEventEmbedding);
  const triggerSubscriptionMatching = useAction(
    api.subscriptionMatching.triggerSubscriptionMatchingForEvent,
  );

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isGeneratingEmbedding, setIsGeneratingEmbedding] = useState(false);
  const [isTriggeringMatching, setIsTriggeringMatching] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;

    if (diff <= 0) {
      return "Ready to run";
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  const handleEdit = (field: string, currentValue: any) => {
    setEditingField(field);
    setEditValues({ [field]: currentValue });
  };

  const handleSave = async (field: string) => {
    setIsUpdating(true);
    try {
      await updateEvent({
        id: eventId as any,
        [field]: editValues[field],
      });
      setEditingField(null);
      toast.success(`${field} updated successfully`);
    } catch (error) {
      toast.error(`Failed to update ${field}`);
      console.error("Error updating event:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValues({});
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this event? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteEvent({ id: eventId as any });
      toast.success("Event deleted successfully");
      onBack();
    } catch (error) {
      toast.error("Failed to delete event");
      console.error("Error deleting event:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleScrape = async () => {
    setIsScraping(true);
    try {
      const result = await scrapeEvent({ eventId: eventId as any });
      if (result.success) {
        toast.success("Event scraped successfully");
      } else {
        toast.error(`Scraping failed: ${result.message}`);
      }
    } catch (error) {
      toast.error("Failed to scrape event");
      console.error("Error scraping event:", error);
    } finally {
      setIsScraping(false);
    }
  };

  const handleGenerateEmbedding = async () => {
    setIsGeneratingEmbedding(true);
    try {
      await generateEmbedding({ eventId: eventId as any });
      toast.success("Embedding generated successfully");
    } catch (error) {
      toast.error("Failed to generate embedding");
      console.error("Error generating embedding:", error);
    } finally {
      setIsGeneratingEmbedding(false);
    }
  };

  const handleTriggerSubscriptionMatching = async () => {
    setIsTriggeringMatching(true);
    try {
      const result = await triggerSubscriptionMatching({
        eventId: eventId as any,
      });
      if (result.success) {
        toast.success("Subscription matching triggered successfully");
      } else {
        toast.error("Failed to trigger subscription matching");
      }
    } catch (error) {
      toast.error("Failed to trigger subscription matching");
      console.error("Error triggering subscription matching:", error);
    } finally {
      setIsTriggeringMatching(false);
    }
  };

  if (event === undefined) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  if (event === null) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Title order={3}>Event not found</Title>
          <Button
            variant="subtle"
            onClick={onBack}
            leftSection={<IconArrowLeft size={16} />}
          >
            Back to Events
          </Button>
        </Stack>
      </Center>
    );
  }

  const renderEditableField = (
    field: string,
    label: string,
    value: any,
    type: "text" | "textarea" | "datetime" = "text",
  ) => {
    const isEditing = editingField === field;

    return (
      <Box
        py="md"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
      >
        <Text fw={500} size="sm" mb="xs" c="gray.7">
          {label}
        </Text>
        {isEditing ? (
          <Stack gap="sm">
            {type === "textarea" ? (
              <Textarea
                value={editValues[field] || ""}
                onChange={(e) =>
                  setEditValues({ ...editValues, [field]: e.target.value })
                }
                rows={4}
                autosize
              />
            ) : type === "datetime" ? (
              <TextInput
                type="datetime-local"
                value={new Date(editValues[field] || value)
                  .toISOString()
                  .slice(0, 16)}
                onChange={(e) =>
                  setEditValues({
                    ...editValues,
                    [field]: new Date(e.target.value).getTime(),
                  })
                }
              />
            ) : (
              <TextInput
                value={editValues[field] || ""}
                onChange={(e) =>
                  setEditValues({ ...editValues, [field]: e.target.value })
                }
              />
            )}
            <Group gap="xs">
              <Button
                onClick={() => handleSave(field)}
                disabled={isUpdating}
                color="green"
                size="sm"
                loading={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save"}
              </Button>
              <Button onClick={handleCancel} variant="default" size="sm">
                Cancel
              </Button>
            </Group>
          </Stack>
        ) : (
          <Group justify="space-between" align="flex-start">
            <Box style={{ flex: 1 }}>
              {type === "datetime" ? (
                <Text>{formatDate(value)}</Text>
              ) : (
                <Text style={{ whiteSpace: "pre-wrap" }}>
                  {value || "Not set"}
                </Text>
              )}
            </Box>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => handleEdit(field, value)}
            >
              Edit
            </Button>
          </Group>
        )}
      </Box>
    );
  };

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={onBack}
          style={{ alignSelf: "flex-start" }}
        >
          Back to Events
        </Button>

        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={1} size="2.5rem">
              Event Debug
            </Title>
            <Text c="dimmed" mt="xs">
              Debug and manage event details
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              onClick={handleScrape}
              disabled={isScraping}
              color="yellow"
              leftSection={<IconSearch size={16} />}
              loading={isScraping}
            >
              {isScraping ? "Scraping..." : "Scrape"}
            </Button>
            <Button
              onClick={handleGenerateEmbedding}
              disabled={isGeneratingEmbedding}
              color="grape"
              leftSection={<IconBrain size={16} />}
              loading={isGeneratingEmbedding}
            >
              {isGeneratingEmbedding ? "Generating..." : "Generate Embedding"}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </Group>
        </Group>

        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Title order={2} mb="lg">
            Basic Information
          </Title>
          <Stack gap={0}>
            {renderEditableField("title", "Title", event.title)}
            {renderEditableField(
              "description",
              "Description",
              event.description,
              "textarea",
            )}
            {renderEditableField(
              "eventDate",
              "Event Date",
              event.eventDate,
              "datetime",
            )}
            {renderEditableField("imageUrl", "Image URL", event.imageUrl)}
            {renderEditableField("url", "Event URL", event.url)}
          </Stack>
        </Card>

        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Title order={2} mb="lg">
            System Information
          </Title>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Box>
              <Text fw={500} size="sm" c="gray.7">
                Event ID:
              </Text>
              <Text ff="monospace" size="sm">
                {event._id}
              </Text>
            </Box>
            <Box>
              <Text fw={500} size="sm" c="gray.7">
                Created:
              </Text>
              <Text size="sm">{formatDate(event._creationTime)}</Text>
            </Box>
            <Box>
              <Text fw={500} size="sm" c="gray.7">
                Last Scraped:
              </Text>
              <Text size="sm">
                {event.lastScraped ? formatDate(event.lastScraped) : "Never"}
              </Text>
            </Box>
            <Box>
              <Text fw={500} size="sm" c="gray.7">
                Has Embedding:
              </Text>
              <Badge
                color={event.descriptionEmbedding ? "green" : "red"}
                size="sm"
                mt="xs"
              >
                {event.descriptionEmbedding ? "Yes" : "No"}
              </Badge>
            </Box>
            {event.sourceId && (
              <Box>
                <Text fw={500} size="sm" c="gray.7">
                  Source ID:
                </Text>
                <Text ff="monospace" size="sm">
                  {event.sourceId}
                </Text>
              </Box>
            )}
          </SimpleGrid>
        </Card>

        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Group justify="space-between" align="center" mb="lg">
            <Title order={2}>Subscription Matching</Title>
            <Button
              onClick={handleTriggerSubscriptionMatching}
              disabled={isTriggeringMatching}
              leftSection={<IconRefresh size={16} />}
              loading={isTriggeringMatching}
            >
              {isTriggeringMatching ? "Triggering..." : "Trigger Now"}
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="lg">
            <Box>
              <Text fw={500} size="sm" c="gray.7">
                Scheduled Job ID:
              </Text>
              <Text ff="monospace" size="sm">
                {event.subscriptionMatchScheduledId || "Not scheduled"}
              </Text>
            </Box>
            <Box>
              <Text fw={500} size="sm" c="gray.7">
                Scheduled For:
              </Text>
              <Text
                size="sm"
                c={
                  event.subscriptionMatchScheduledAt &&
                  event.subscriptionMatchScheduledAt <= Date.now()
                    ? "green.6"
                    : undefined
                }
                fw={
                  event.subscriptionMatchScheduledAt &&
                  event.subscriptionMatchScheduledAt <= Date.now()
                    ? 500
                    : undefined
                }
              >
                {event.subscriptionMatchScheduledAt
                  ? `${formatDate(event.subscriptionMatchScheduledAt)} (${formatRelativeTime(event.subscriptionMatchScheduledAt)})`
                  : "Not scheduled"}
              </Text>
            </Box>
          </SimpleGrid>

          <Card bg="blue.0" padding="md" radius="md">
            <Text size="sm" c="blue.8">
              💡{" "}
              <Text span fw={500}>
                Subscription matching
              </Text>{" "}
              runs automatically 8 hours after an event is created or updated.
              It checks this event against all active user subscriptions and
              adds matching events to email queues.
            </Text>
          </Card>
        </Card>

        {event.scrapedData && (
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
                      : value || "Not available"}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          </Card>
        )}

        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Title order={2} mb="lg">
            Event Preview
          </Title>
          <Card withBorder padding="lg" radius="md">
            {event.imageUrl && (
              <Card.Section>
                <Image
                  src={event.imageUrl}
                  alt={event.title}
                  height={192}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </Card.Section>
            )}
            <Stack gap="md" mt={event.imageUrl ? "md" : 0}>
              <Title order={3} size="lg">
                {event.title}
              </Title>
              <Text c="dimmed">{event.description}</Text>
              <Group gap="lg">
                <Group gap="xs">
                  <IconCalendar size={16} />
                  <Text size="sm" c="dimmed">
                    {formatDate(event.eventDate)}
                  </Text>
                </Group>
                <Text
                  component="a"
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  c="blue.6"
                  style={{ textDecoration: "none" }}
                  size="sm"
                >
                  <Group gap="xs">
                    <IconExternalLink size={16} />
                    <Text>View Original</Text>
                  </Group>
                </Text>
              </Group>
            </Stack>
          </Card>
        </Card>
      </Stack>
    </Container>
  );
}
