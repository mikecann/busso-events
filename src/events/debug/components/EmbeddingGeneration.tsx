import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
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
import { IconBrain } from "@tabler/icons-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface DebugSectionProps {
  eventId: Id<"events">;
}

export function EmbeddingGeneration({ eventId }: DebugSectionProps) {
  const embeddingWorkpoolStatus = useQuery(
    api.events.events.getEmbeddingWorkpoolStatus,
    {
      eventId,
    },
  );
  const generateEmbedding = useAction(
    api.embeddings.embeddings.generateEventEmbedding,
  );

  const [isGeneratingEmbedding, setIsGeneratingEmbedding] = useState(false);
  const onApiError = useAPIErrorHandler();

  return (
    <Card shadow="sm" padding="xl" radius="lg" withBorder>
      <Group justify="space-between" align="center" mb="lg">
        <Title order={2}>Embedding Generation</Title>
        <Button
          onClick={() => {
            setIsGeneratingEmbedding(true);
            generateEmbedding({ eventId })
              .then((result) => {
                if (result.success) {
                  notifications.show({
                    message: "Embedding generated successfully",
                    color: "green",
                  });
                } else {
                  notifications.show({
                    message: "Embedding generation failed",
                    color: "red",
                  });
                }
              })
              .catch(onApiError)
              .finally(() => setIsGeneratingEmbedding(false));
          }}
          disabled={isGeneratingEmbedding}
          color="purple"
          leftSection={<IconBrain size={16} />}
          loading={isGeneratingEmbedding}
        >
          {isGeneratingEmbedding ? "Generating..." : "Generate Now"}
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="lg">
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Workpool ID:
          </Text>
          <Text ff="monospace" size="sm">
            {embeddingWorkpoolStatus?.workId || "Not queued"}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Enqueued At:
          </Text>
          <Text size="sm">
            {embeddingWorkpoolStatus?.enqueuedAt
              ? formatDate(embeddingWorkpoolStatus.enqueuedAt)
              : "Not queued"}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Status:
          </Text>
          <Group gap="xs">
            {embeddingWorkpoolStatus?.status ? (
              <>
                <Badge
                  color={
                    embeddingWorkpoolStatus.status.state === "pending"
                      ? "yellow"
                      : embeddingWorkpoolStatus.status.state === "running"
                        ? "blue"
                        : embeddingWorkpoolStatus.status.state === "finished"
                          ? "green"
                          : "red"
                  }
                >
                  {embeddingWorkpoolStatus.status.state}
                </Badge>
                {embeddingWorkpoolStatus.status.retryCount !== undefined &&
                  embeddingWorkpoolStatus.status.retryCount > 0 && (
                    <Text size="xs" c="dimmed">
                      Retries: {embeddingWorkpoolStatus.status.retryCount}
                    </Text>
                  )}
              </>
            ) : embeddingWorkpoolStatus?.error ? (
              <Badge color="red">Error: {embeddingWorkpoolStatus.error}</Badge>
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
            {embeddingWorkpoolStatus?.status?.state === "pending" &&
            embeddingWorkpoolStatus.status.queuePosition !== undefined
              ? `#${embeddingWorkpoolStatus.status.queuePosition + 1}`
              : ""}
          </Text>
        </Box>
      </SimpleGrid>

      <Card bg="grape.0" padding="md" radius="md">
        <Text size="sm" c="grape.8">
          🧠{" "}
          <Text span fw={500}>
            Automatic embedding generation
          </Text>{" "}
          is queued in a workpool after an event is scraped. The workpool
          processes embedding jobs with a maximum parallelism of 2 to avoid
          overwhelming the OpenAI API, generating vector embeddings from the
          event description for semantic search and subscription matching.
        </Text>
      </Card>
    </Card>
  );
}
