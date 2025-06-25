import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { useAPIErrorHandler } from "../utils/hooks";
import { formatDateDetailed as formatDate } from "../utils/dateUtils";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Box,
  SimpleGrid,
  Badge,
  Table,
  Divider,
  Alert,
  ActionIcon,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconRefresh,
  IconTrash,
  IconInfoCircle,
  IconCpu,
  IconClock,
  IconExternalLink,
} from "@tabler/icons-react";

type WorkpoolType =
  | "eventScrapeWorkpool"
  | "eventEmbeddingWorkpool"
  | "subscriptionMatchWorkpool";

interface WorkpoolDebugPageProps {
  workpoolType: WorkpoolType;
  onBack: () => void;
  onNavigateToEventDebug?: (eventId: string) => void;
}

export function WorkpoolDebugPage({
  workpoolType,
  onBack,
  onNavigateToEventDebug,
}: WorkpoolDebugPageProps) {
  const workpoolStatus = useQuery(
    api.events.eventsAdmin.getWorkpoolDetailedStatus,
    {
      workpoolType,
    },
  );
  const clearWorkpoolJobs = useAction(api.events.eventsAdmin.clearWorkpoolJobs);

  const [isClearing, setIsClearing] = useState(false);
  const onApiError = useAPIErrorHandler();

  const getWorkpoolIcon = (type: WorkpoolType) => {
    switch (type) {
      case "eventScrapeWorkpool":
        return "🕷️";
      case "eventEmbeddingWorkpool":
        return "🧠";
      case "subscriptionMatchWorkpool":
        return "🎯";
      default:
        return "⚙️";
    }
  };

  const getWorkpoolColor = (type: WorkpoolType) => {
    switch (type) {
      case "eventScrapeWorkpool":
        return "yellow";
      case "eventEmbeddingWorkpool":
        return "grape";
      case "subscriptionMatchWorkpool":
        return "blue";
      default:
        return "gray";
    }
  };

  if (!workpoolStatus) {
    return (
      <Container size="lg">
        <Stack gap="lg">
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="subtle"
            onClick={onBack}
            style={{ alignSelf: "flex-start" }}
          >
            Back to Admin Dashboard
          </Button>
          <Text>Loading workpool status...</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={onBack}
          style={{ alignSelf: "flex-start" }}
        >
          Back to Admin Dashboard
        </Button>

        {/* Workpool Header */}
        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Group justify="space-between" align="flex-start">
            <Box>
              <Group gap="sm" mb="xs">
                <Text size="2xl">{getWorkpoolIcon(workpoolType)}</Text>
                <Title order={1} size="2rem">
                  {workpoolStatus.name}
                </Title>
                <Badge color={getWorkpoolColor(workpoolType)} size="lg">
                  {workpoolStatus.totalJobs} queued
                </Badge>
              </Group>
              <Text c="dimmed" size="lg" mb="md">
                {workpoolStatus.description}
              </Text>
            </Box>
            <Group gap="sm">
              <Button
                onClick={() => window.location.reload()}
                leftSection={<IconRefresh size={16} />}
                variant="light"
              >
                Refresh
              </Button>
              <Button
                onClick={() => {
                  setIsClearing(true);
                  clearWorkpoolJobs({ workpoolType })
                    .then((result) => {
                      if (result.success) {
                        notifications.show({
                          message: result.message,
                          color: "green",
                        });
                      } else {
                        notifications.show({
                          message: "Failed to clear workpool jobs",
                          color: "red",
                        });
                      }
                    })
                    .catch(onApiError)
                    .finally(() => setIsClearing(false));
                }}
                disabled={isClearing || workpoolStatus.totalJobs === 0}
                color="red"
                leftSection={<IconTrash size={16} />}
                loading={isClearing}
              >
                {isClearing ? "Clearing..." : "Clear All Jobs"}
              </Button>
            </Group>
          </Group>
        </Card>

        {/* Workpool Stats */}
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="sm" mb="xs">
              <IconCpu size={20} color="var(--mantine-color-blue-6)" />
              <Text fw={500} size="sm">
                Max Parallelism
              </Text>
            </Group>
            <Text size="xl" fw={700} c="blue.6">
              {workpoolStatus.maxParallelism}
            </Text>
            <Text size="xs" c="dimmed">
              Maximum concurrent jobs
            </Text>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="sm" mb="xs">
              <IconClock size={20} color="var(--mantine-color-orange-6)" />
              <Text fw={500} size="sm">
                Total Jobs
              </Text>
            </Group>
            <Text size="xl" fw={700} c="orange.6">
              {workpoolStatus.totalJobs}
            </Text>
            <Text size="xs" c="dimmed">
              Jobs currently queued
            </Text>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="sm" mb="xs">
              <IconInfoCircle size={20} color="var(--mantine-color-green-6)" />
              <Text fw={500} size="sm">
                Workpool Type
              </Text>
            </Group>
            <Text size="lg" fw={500} c="green.6">
              {workpoolType}
            </Text>
            <Text size="xs" c="dimmed">
              Component identifier
            </Text>
          </Card>
        </SimpleGrid>

        {/* Jobs Table */}
        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Group justify="space-between" align="center" mb="lg">
            <Title order={2}>Queued Jobs</Title>
            <Badge color="gray" size="lg">
              {workpoolStatus.totalJobs} total
            </Badge>
          </Group>

          {workpoolStatus.totalJobs === 0 ? (
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              No jobs currently queued in this workpool.
            </Alert>
          ) : (
            <Box style={{ overflowX: "auto" }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Event</Table.Th>
                    <Table.Th>Work ID</Table.Th>
                    <Table.Th>Enqueued At</Table.Th>
                    <Table.Th>Event Date</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {workpoolStatus.jobs.map((job: any) => (
                    <Table.Tr key={job.eventId}>
                      <Table.Td>
                        <Box>
                          <Text fw={500} size="sm">
                            {job.eventTitle}
                          </Text>
                          <Text
                            size="xs"
                            c="dimmed"
                            style={{ wordBreak: "break-all" }}
                          >
                            {job.eventUrl}
                          </Text>
                        </Box>
                      </Table.Td>
                      <Table.Td>
                        <Text ff="monospace" size="xs">
                          {job.workId || "N/A"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {job.enqueuedAt ? formatDate(job.enqueuedAt) : "N/A"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(job.eventDate)}</Text>
                      </Table.Td>
                      <Table.Td>
                        {onNavigateToEventDebug && (
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => onNavigateToEventDebug(job.eventId)}
                          >
                            <IconExternalLink size={16} />
                          </ActionIcon>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          )}
        </Card>

        {/* Workpool Information */}
        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Title order={3} mb="md">
            How This Workpool Works
          </Title>
          <Stack gap="sm">
            <Text size="sm">
              <Text span fw={500}>
                Maximum Parallelism:
              </Text>{" "}
              This workpool can process up to {workpoolStatus.maxParallelism}{" "}
              job(s) simultaneously to balance performance with resource
              constraints.
            </Text>
            <Text size="sm">
              <Text span fw={500}>
                Job Processing:
              </Text>{" "}
              Jobs are processed in a first-in, first-out (FIFO) order, ensuring
              consistent and predictable execution.
            </Text>
            <Text size="sm">
              <Text span fw={500}>
                Retry Logic:
              </Text>{" "}
              Failed jobs are automatically retried with exponential backoff to
              handle temporary failures gracefully.
            </Text>
            <Text size="sm">
              <Text span fw={500}>
                Monitoring:
              </Text>{" "}
              Each job's status can be monitored individually through the event
              debug pages for detailed diagnostics.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
