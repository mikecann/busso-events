import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { useAPIErrorHandler } from "../utils/hooks";
import {
  formatDate,
  formatDateShort,
  formatRelativeTime,
  formatTime,
  isUpcoming,
} from "../utils/dateUtils";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Badge,
  Box,
  Table,
  Pagination,
  Center,
  Loader,
  Alert,
  Anchor,
  Divider,
  SimpleGrid,
  ThemeIcon,
  TextInput,
  Modal,
  Image,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconRefresh,
  IconCalendar,
  IconExternalLink,
  IconAlertCircle,
  IconGlobe,
  IconClock,
  IconDatabase,
  IconTrendingUp,
  IconPlayerPlay,
  IconPlayerPause,
  IconEdit,
  IconTrash,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { navigation } from "../router";

interface SourceDetailPageProps {
  sourceId: string;
  onBack: () => void;
}

export function SourceDetailPage({ sourceId, onBack }: SourceDetailPageProps) {
  const source = useQuery(api.eventSources.getById, {
    sourceId: sourceId as Id<"eventSources">,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const numItems = 20;

  const eventsData = useQuery(api.eventSources.getEventsBySource, {
    sourceId: sourceId as Id<"eventSources">,
    paginationOpts: {
      numItems,
      cursor: null, // For simplicity, we'll implement basic pagination
    },
  });

  const updateSource = useMutation(api.eventSources.update);
  const deleteSource = useMutation(api.eventSources.remove);
  const testScrape = useAction(api.eventSources.testScrape);
  const [isScrapingNow, setIsScrapingNow] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const onApiError = useAPIErrorHandler();

  if (source === undefined || eventsData === undefined) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  if (source === null) {
    return (
      <Container size="lg">
        <Stack gap="lg">
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="subtle"
            onClick={onBack}
            style={{ alignSelf: "flex-start" }}
          >
            Back to Sources
          </Button>
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Source not found"
            color="red"
          >
            The event source you're looking for doesn't exist or has been
            deleted.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const { page: events, stats } = eventsData;

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={onBack}
          style={{ alignSelf: "flex-start" }}
        >
          Back to Sources
        </Button>

        {/* Source Header */}
        <Group justify="space-between" align="flex-start">
          <Box>
            <Group gap="sm" mb="xs">
              <Box
                w={16}
                h={16}
                bg={source.isActive ? "green.5" : "gray.4"}
                style={{ borderRadius: "50%" }}
              />
              <Badge color={source.isActive ? "green" : "gray"} size="lg">
                {source.isActive ? "Active" : "Inactive"}
              </Badge>
            </Group>
            <Title order={1} size="2.5rem" mb="xs">
              {source.name}
            </Title>
            <Group gap="xs" mb="md">
              <IconGlobe size={16} />
              <Anchor
                href={source.startingUrl}
                target="_blank"
                rel="noopener noreferrer"
                c="dimmed"
                style={{ wordBreak: "break-all" }}
              >
                {source.startingUrl}
                <IconExternalLink size={12} style={{ marginLeft: 4 }} />
              </Anchor>
            </Group>
            <Text c="dimmed">
              Last scraped:{" "}
              {source.dateLastScrape
                ? formatDate(source.dateLastScrape)
                : "Never"}
            </Text>
            <Text c="dimmed">
              Next scrape:{" "}
              {source.nextScrapeScheduledAt
                ? formatDate(source.nextScrapeScheduledAt)
                : source.isActive
                  ? "Not scheduled"
                  : "Inactive"}
            </Text>
          </Box>

          <Group gap="sm">
            <Button
              onClick={() =>
                updateSource({
                  id: source._id,
                  isActive: !source.isActive,
                })
                  .then(() => {
                    toast.success(
                      `Source ${!source.isActive ? "activated" : "deactivated"}`,
                    );
                  })
                  .catch(onApiError)
              }
              variant="light"
              color={source.isActive ? "yellow" : "green"}
              leftSection={
                source.isActive ? (
                  <IconPlayerPause size={16} />
                ) : (
                  <IconPlayerPlay size={16} />
                )
              }
            >
              {source.isActive ? "Pause Source" : "Activate Source"}
            </Button>

            <Button
              onClick={() => {
                setIsScrapingNow(true);
                testScrape({ sourceId: source._id })
                  .then((result) => {
                    if (result.success) {
                      toast.success(
                        `Scrape completed! Found ${result.eventsFound || 0} events.`,
                      );
                    } else {
                      toast.error(`Scrape failed: ${result.message}`);
                    }
                  })
                  .catch(onApiError)
                  .finally(() => setIsScrapingNow(false));
              }}
              color="orange"
              leftSection={<IconRefresh size={16} />}
              loading={isScrapingNow}
              disabled={!source.isActive || isScrapingNow}
            >
              {isScrapingNow ? "Scraping..." : "Scrape Now"}
            </Button>

            <Button
              onClick={() => {
                setEditName(source.name);
                setEditUrl(source.startingUrl);
                setIsEditing(true);
              }}
              variant="light"
              color="blue"
              leftSection={<IconEdit size={16} />}
            >
              Edit Source
            </Button>

            <Button
              onClick={() => {
                if (
                  !confirm(
                    "Are you sure you want to delete this source? This action cannot be undone.",
                  )
                )
                  return;

                deleteSource({ id: source._id })
                  .then(() => {
                    toast.success("Source deleted successfully");
                    onBack(); // Navigate back to sources list
                  })
                  .catch(onApiError);
              }}
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} />}
            >
              Delete Source
            </Button>
          </Group>
        </Group>

        {/* Statistics Cards */}
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="lg">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Total Events
                </Text>
                <Text size="xl" fw={700} c="blue.6">
                  {stats.totalEvents}
                </Text>
              </Box>
              <ThemeIcon variant="light" size={32} radius="md" color="blue">
                <IconDatabase size={16} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Upcoming
                </Text>
                <Text size="xl" fw={700} c="green.6">
                  {stats.upcomingEvents}
                </Text>
              </Box>
              <ThemeIcon variant="light" size={32} radius="md" color="green">
                <IconTrendingUp size={16} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Past Events
                </Text>
                <Text size="xl" fw={700} c="gray.6">
                  {stats.pastEvents}
                </Text>
              </Box>
              <ThemeIcon variant="light" size={32} radius="md" color="gray">
                <IconClock size={16} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Date Range
                </Text>
                <Text size="sm" fw={500}>
                  {stats.oldestEvent && stats.newestEvent
                    ? `${formatDateShort(stats.oldestEvent)} - ${formatDateShort(stats.newestEvent)}`
                    : "No events"}
                </Text>
              </Box>
              <ThemeIcon variant="light" size={32} radius="md" color="violet">
                <IconCalendar size={16} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        <Divider />

        {/* Events List */}
        <Box>
          <Title order={2} mb="lg">
            Events from this Source
          </Title>

          {events.length === 0 ? (
            <Card
              shadow="sm"
              padding="xl"
              radius="lg"
              withBorder
              style={{ textAlign: "center" }}
            >
              <Text size="4rem" style={{ marginBottom: "1rem" }}>
                📅
              </Text>
              <Title order={3} mb="xs">
                No events found
              </Title>
              <Text c="dimmed">
                This source hasn't scraped any events yet. Try running a scrape
                to discover events.
              </Text>
            </Card>
          ) : (
            <Card shadow="sm" padding="xl" radius="lg" withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: "80px" }}>Image</Table.Th>
                    <Table.Th style={{ width: "40%" }}>Event</Table.Th>
                    <Table.Th style={{ width: "18%" }}>Date</Table.Th>
                    <Table.Th style={{ width: "18%" }}>Last Scraped</Table.Th>
                    <Table.Th style={{ width: "14%" }}>Embeddings</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {events.map((event: Doc<"events">) => (
                    <Table.Tr
                      key={event._id}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        navigation.eventDebug(event._id as Id<"events">).push()
                      }
                    >
                      <Table.Td style={{ width: "80px" }}>
                        <Image
                          src={event.imageUrl || undefined}
                          alt={event.title}
                          width={60}
                          height={60}
                          radius="md"
                          fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f3f4'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='30' fill='%23666'%3E📅%3C/text%3E%3C/svg%3E"
                          style={{ flexShrink: 0 }}
                        />
                      </Table.Td>
                      <Table.Td style={{ width: "40%" }}>
                        <Box>
                          <Text fw={500} size="sm" lineClamp={2}>
                            {event.title}
                          </Text>
                          {event.description && (
                            <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
                              {event.description}
                            </Text>
                          )}
                        </Box>
                      </Table.Td>
                      <Table.Td style={{ width: "18%" }}>
                        <Box>
                          <Text size="sm" fw={500}>
                            {formatDateShort(event.eventDate)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatTime(event.eventDate)}
                          </Text>
                        </Box>
                      </Table.Td>
                      <Table.Td style={{ width: "18%" }}>
                        <Text size="sm" c="dimmed">
                          {formatRelativeTime(event.lastScraped)}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ width: "14%" }}>
                        <Badge
                          color={event.descriptionEmbedding ? "green" : "gray"}
                          size="sm"
                          variant="light"
                        >
                          {event.descriptionEmbedding ? "Yes" : "No"}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {eventsData.continueCursor && (
                <Group justify="center" mt="lg">
                  <Button
                    variant="light"
                    onClick={() => {
                      // TODO: Implement pagination with continueCursor
                      toast.info("Pagination coming soon!");
                    }}
                  >
                    Load More Events
                  </Button>
                </Group>
              )}
            </Card>
          )}
        </Box>

        {/* Edit Modal */}
        <Modal
          opened={isEditing}
          onClose={() => setIsEditing(false)}
          title="Edit Event Source"
          size="md"
        >
          <Stack gap="md">
            <TextInput
              label="Source Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter source name"
              required
            />
            <TextInput
              label="Starting URL"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="https://example.com/events"
              type="url"
              required
            />
            <Group justify="flex-end" gap="sm">
              <Button
                variant="light"
                onClick={() => setIsEditing(false)}
                leftSection={<IconX size={16} />}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateSource({
                    id: source!._id,
                    name: editName,
                    startingUrl: editUrl,
                  })
                    .then(() => {
                      toast.success("Source updated successfully");
                      setIsEditing(false);
                    })
                    .catch(onApiError);
                }}
                color="blue"
                leftSection={<IconCheck size={16} />}
                disabled={!editName.trim() || !editUrl.trim()}
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
