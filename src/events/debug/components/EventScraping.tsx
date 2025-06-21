import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { useAPIErrorHandler } from "../../../utils/hooks";
import { formatDateDetailed as formatDate } from "../../../utils/dateUtils";
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Badge,
  Box,
  SimpleGrid,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface DebugSectionProps {
  eventId: Id<"events">;
}

export function EventScraping({ eventId }: DebugSectionProps) {
  const workpoolStatus = useQuery(api.events.events.getWorkpoolStatus, {
    eventId,
  });
  const scrapeEvent = useAction(api.events.eventsAdmin.scrapeEvent);

  const [isScraping, setIsScraping] = useState(false);
  const onApiError = useAPIErrorHandler();

  return (
    <Card shadow="sm" padding="xl" radius="lg" withBorder>
      <Group justify="space-between" align="center" mb="lg">
        <Title order={2}>Event Scraping</Title>
        <Button
          onClick={() => {
            setIsScraping(true);
            scrapeEvent({ eventId })
              .then((result) => {
                if (result.success) {
                  toast.success("Event scraped successfully");
                } else {
                  toast.error(`Scraping failed: ${result.message}`);
                }
              })
              .catch(onApiError)
              .finally(() => setIsScraping(false));
          }}
          disabled={isScraping}
          color="yellow"
          leftSection={<IconSearch size={16} />}
          loading={isScraping}
        >
          {isScraping ? "Scraping..." : "Scrape Now"}
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="lg">
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Workpool ID:
          </Text>
          <Text ff="monospace" size="sm">
            {workpoolStatus?.workId || "Not queued"}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Enqueued At:
          </Text>
          <Text size="sm">
            {workpoolStatus?.enqueuedAt
              ? formatDate(workpoolStatus.enqueuedAt)
              : "Not queued"}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Status:
          </Text>
          <Group gap="xs">
            {workpoolStatus?.status ? (
              <>
                <Badge
                  color={
                    workpoolStatus.status.state === "pending"
                      ? "yellow"
                      : workpoolStatus.status.state === "running"
                        ? "blue"
                        : workpoolStatus.status.state === "finished"
                          ? "green"
                          : "red"
                  }
                >
                  {workpoolStatus.status.state}
                </Badge>
                {workpoolStatus.status.retryCount !== undefined &&
                  workpoolStatus.status.retryCount > 0 && (
                    <Text size="xs" c="dimmed">
                      Retries: {workpoolStatus.status.retryCount}
                    </Text>
                  )}
              </>
            ) : workpoolStatus?.error ? (
              <Badge color="red">Error: {workpoolStatus.error}</Badge>
            ) : (
              <Text size="sm" c="gray.6">
                Not queued
              </Text>
            )}
          </Group>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Queue Position:
          </Text>
          <Text size="sm">
            {workpoolStatus?.status?.state === "pending" &&
            workpoolStatus.status.queuePosition !== undefined
              ? `#${workpoolStatus.status.queuePosition + 1}`
              : ""}
          </Text>
        </Box>
      </SimpleGrid>

      <Card bg="yellow.0" padding="md" radius="md">
        <Text size="sm" c="yellow.8">
          🕷️{" "}
          <Text span fw={500}>
            Event scraping
          </Text>{" "}
          fetches the latest content from the event URL to enhance the event
          description and extract structured data. The workpool processes
          scraping jobs with a maximum parallelism of 5 to respect rate limits.
        </Text>
      </Card>
    </Card>
  );
}
