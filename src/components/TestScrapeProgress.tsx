import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Paper,
  Stack,
  Group,
  Text,
  Progress,
  Alert,
  Box,
  Title,
  Table,
} from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";

interface TestScrapeProgressProps {
  testScrapeId: Id<"testScrapes"> | null;
}

export function TestScrapeProgress({ testScrapeId }: TestScrapeProgressProps) {
  const testScrape = useQuery(
    api.eventSources.eventSources.getTestScrapeByIdPublic,
    testScrapeId ? { testScrapeId } : "skip",
  );

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
}
