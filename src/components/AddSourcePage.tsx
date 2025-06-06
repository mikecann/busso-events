import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  TextInput,
  Alert,
  Box,
  Progress,
  Paper,
  Table,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconSearch,
  IconAlertTriangle,
  IconCheck,
  IconX,
} from "@tabler/icons-react";

interface AddSourcePageProps {
  onBack: () => void;
}

export function AddSourcePage({ onBack }: AddSourcePageProps) {
  const createSource = useMutation(api.eventSources.create);
  const startTestScrape = useMutation(api.eventSources.startTestScrape);

  const [currentTestScrapeId, setCurrentTestScrapeId] =
    useState<Id<"testScrapes"> | null>(null);

  const testScrape = useQuery(
    api.eventSources.getTestScrapeByIdPublic,
    currentTestScrapeId ? { testScrapeId: currentTestScrapeId } : "skip",
  );

  const [formData, setFormData] = useState({
    name: "",
    startingUrl: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createSource({
        name: formData.name,
        startingUrl: formData.startingUrl,
      });
      toast.success("Event source created successfully!");
      onBack();
    } catch (error) {
      toast.error("Failed to create event source");
      console.error("Error creating source:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestScrape = async () => {
    if (!formData.startingUrl) {
      toast.error("Please enter a URL first");
      return;
    }
    setCurrentTestScrapeId(
      await startTestScrape({ url: formData.startingUrl }),
    );
  };

  const renderTestScrapeProgress = () => {
    if (!testScrape) return null;
    const getStageProgress = () => {
      switch (testScrape.progress?.stage) {
        case "fetching":
          return 33;
        case "extracting":
          return 66;
        case "processing":
          return 90;
        default:
          return 0;
      }
    };
    const getStatusColor = () => {
      switch (testScrape.status) {
        case "completed":
          return "green";
        case "failed":
          return "red";
        case "running":
          return "blue";
        default:
          return "gray";
      }
    };
    return (
      <Paper withBorder p="md" radius="md" mt="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={500}>Test Scrape Progress</Text>
            {testScrape.status === "completed" && (
              <IconCheck size={16} color="green" />
            )}
            {testScrape.status === "failed" && <IconX size={16} color="red" />}
          </Group>
          <Progress
            value={getStageProgress()}
            color={getStatusColor()}
            size="sm"
          />
          <Text size="sm" c="dimmed">
            {testScrape.progress?.message || "Initializing..."}
          </Text>
          {testScrape.result && (
            <Alert
              color={testScrape.result.success ? "green" : "red"}
              title={
                testScrape.result.success ? "Test Successful" : "Test Failed"
              }
            >
              {testScrape.result.message}
              {testScrape.result.eventsFound !== undefined && (
                <Text size="sm" mt="xs">
                  Found {testScrape.result.eventsFound} potential events
                </Text>
              )}
            </Alert>
          )}
          {/* Show event details if available */}
          {testScrape.status === "completed" &&
            testScrape.result?.data?.extractedEvents &&
            testScrape.result.data.extractedEvents.length > 0 && (
              <Box mt="md">
                <Title order={4} mb="xs">
                  Extracted Events
                </Title>
                <Table striped withRowBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>URL</Table.Th>
                      <Table.Th>Date</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {testScrape.result.data.extractedEvents.map(
                      (event: any, i: number) => (
                        <Table.Tr key={i}>
                          <Table.Td>{event.title}</Table.Td>
                          <Table.Td>
                            {event.url ? (
                              <a
                                href={event.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {event.url}
                              </a>
                            ) : (
                              ""
                            )}
                          </Table.Td>
                          <Table.Td>{event.eventDate || ""}</Table.Td>
                        </Table.Tr>
                      ),
                    )}
                  </Table.Tbody>
                </Table>
              </Box>
            )}
        </Stack>
      </Paper>
    );
  };

  return (
    <Container size="md">
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={() => void onBack()}
          style={{ alignSelf: "flex-start" }}
        >
          Back to Sources
        </Button>
        <Box>
          <Title order={1} size="2.5rem">
            Add Event Source
          </Title>
          <Text c="dimmed" mt="xs">
            Configure a new source for automatic event discovery
          </Text>
        </Box>
        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <form onSubmit={handleSubmit}>
            <Stack gap="lg">
              <TextInput
                label="Source Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Tech Events SF, Startup Meetups"
                required
              />
              <Box>
                <TextInput
                  label="Starting URL"
                  type="url"
                  value={formData.startingUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, startingUrl: e.target.value })
                  }
                  placeholder="https://example.com/events"
                  required
                />
                <Text size="sm" c="dimmed" mt="xs">
                  The URL where the scraper should start looking for events
                </Text>
              </Box>
              {renderTestScrapeProgress()}
              <Alert
                icon={<IconAlertTriangle size={16} />}
                title="Important Note"
                color="yellow"
              >
                Make sure the URL you provide contains event listings that can
                be scraped. The system will attempt to automatically discover
                and extract event information.
              </Alert>
              <Group justify="space-between">
                <Button
                  type="button"
                  onClick={() => void onBack()}
                  variant="default"
                  size="lg"
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleTestScrape()}
                  disabled={!formData.startingUrl}
                  color="yellow"
                  size="lg"
                  style={{ flex: 1 }}
                  leftSection={<IconSearch size={16} />}
                >
                  {"Test Scrape"}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="lg"
                  style={{ flex: 1 }}
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Source"}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
}
