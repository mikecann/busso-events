import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { useAPIErrorHandler } from "../utils/hooks";
import { formatRelativeTimeBidirectional } from "../utils/dateUtils";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Badge,
  SimpleGrid,
  Box,
  Progress,
  Divider,
  List,
  ThemeIcon,
} from "@mantine/core";
import {
  IconBrain,
  IconSettings,
  IconClock,
  IconDatabase,
  IconMail,
  IconCalendar,
  IconCheck,
  IconX,
  IconLoader,
  IconSearch,
  IconExternalLink,
  IconCpu,
  IconTrash,
  IconBrush,
  IconBell,
  IconBellRinging,
  IconTool,
} from "@tabler/icons-react";

interface AppAdminPageProps {
  onNavigateToSources: () => void;
  onNavigateToSubscriptionDebug: () => void;
  onNavigateToWorkpoolDebug: (
    workpoolType:
      | "eventScrapeWorkpool"
      | "eventEmbeddingWorkpool"
      | "subscriptionMatchWorkpool"
      | "subscriptionEmailWorkpool",
  ) => void;
}

export function AppAdminPage({
  onNavigateToSources,
  onNavigateToSubscriptionDebug,
  onNavigateToWorkpoolDebug,
}: AppAdminPageProps) {
  const eventsReadyForScraping = useQuery(
    api.events.eventsAdmin.getEventsReadyForScraping,
  );
  const generateMissingEmbeddings = useAction(
    api.embeddings.embeddingsAdmin.generateMissingEmbeddings,
  );
  const deleteAllEvents = useAction(api.events.eventsAdmin.deleteAllEvents);
  const clearAllWorkpools = useAction(api.events.eventsAdmin.clearAllWorkpools);
  const fixMissingSourceSchedules = useAction(
    api.eventSources.eventSourcesAdmin.fixMissingSourceSchedules,
  );
  const queueStats = useQuery(api.emails.emails.getQueueStats);
  const jobsStatus = useQuery(api.jobs.getSystemStatus);
  const schedulingInfo = useQuery(api.events.eventsAdmin.getSchedulingInfo);
  const sourcesStatus = useQuery(
    api.eventSources.eventSourcesAdmin.getSourcesStatus,
  );
  const workpoolsStatus = useQuery(api.events.eventsAdmin.getWorkpoolsStatus);

  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [isDeletingAllEvents, setIsDeletingAllEvents] = useState(false);
  const [isClearingAllWorkpools, setIsClearingAllWorkpools] = useState(false);
  const [isFixingSchedules, setIsFixingSchedules] = useState(false);

  const onApiError = useAPIErrorHandler();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "green";
      case "running":
        return "blue";
      case "pending":
        return "yellow";
      case "failed":
        return "red";
      default:
        return "gray";
    }
  };

  const handleDeleteAllEvents = () => {
    if (
      !confirm(
        "⚠️ This will delete ALL events from the database. This action cannot be undone. Are you sure?",
      )
    ) {
      return;
    }

    const confirmation = prompt(
      "🚨 FINAL WARNING: This will permanently delete ALL events.\nType 'DELETE ALL' to confirm:",
    );
    if (confirmation !== "DELETE ALL") {
      notifications.show({
        title: "Cancelled",
        message: "Deletion cancelled - confirmation text did not match",
        color: "blue",
      });
      return;
    }

    setIsDeletingAllEvents(true);
    deleteAllEvents({})
      .then((result) => {
        notifications.show({
          title: "Success",
          message: `Successfully deleted ${result.deletedCount} events`,
          color: "green",
        });
        if (result.failedCount > 0) {
          notifications.show({
            title: "Warning",
            message: `Failed to delete ${result.failedCount} events`,
            color: "yellow",
          });
        }
      })
      .catch(onApiError)
      .finally(() => setIsDeletingAllEvents(false));
  };

  const handleClearAllWorkpools = () => {
    if (
      !confirm(
        "This will clear all pending jobs from all workpools. Are you sure?",
      )
    ) {
      return;
    }

    setIsClearingAllWorkpools(true);
    clearAllWorkpools({})
      .then((result) => {
        notifications.show({
          title: "Success",
          message: `Successfully cleared ${result.totalCleared} jobs from all workpools`,
          color: "green",
        });
        if (result.totalFailed > 0) {
          notifications.show({
            title: "Warning",
            message: `Failed to clear ${result.totalFailed} jobs`,
            color: "yellow",
          });
        }
      })
      .catch(onApiError)
      .finally(() => setIsClearingAllWorkpools(false));
  };

  const handleFixMissingSchedules = () => {
    if (
      !confirm(
        "This will schedule next scrapes for all sources that don't have one. Are you sure?",
      )
    ) {
      return;
    }

    setIsFixingSchedules(true);
    fixMissingSourceSchedules({})
      .then((result) => {
        notifications.show({
          title: "Success",
          message: `Checked ${result.sourcesChecked} sources and fixed ${result.sourcesFixed} missing schedules`,
          color: "green",
        });

        // Show detailed results
        if (result.sources.some((s) => s.error)) {
          const failedSources = result.sources.filter((s) => s.error);
          notifications.show({
            title: "Some Sources Failed",
            message: `${failedSources.length} sources failed to schedule: ${failedSources.map((s) => s.name).join(", ")}`,
            color: "yellow",
          });
        }
      })
      .catch(onApiError)
      .finally(() => setIsFixingSchedules(false));
  };

  return (
    <Container size="xl">
      <Stack gap="xl">
        <Box>
          <Title order={1} size="2.5rem">
            Admin Dashboard
          </Title>
          <Text c="dimmed" mt="xs">
            Monitor system status, scheduled operations, and manage resources
          </Text>
        </Box>

        {/* Key Metrics */}
        <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Events Ready for Scraping
                </Text>
                <Text size="2xl" fw={700} c="blue.6">
                  {eventsReadyForScraping?.length || 0}
                </Text>
              </Box>
              <ThemeIcon variant="light" size={38} radius="md" color="blue">
                <IconDatabase size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Email Queue
                </Text>
                <Text size="2xl" fw={700} c="orange.6">
                  {queueStats?.unsent || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  {queueStats?.sent || 0} sent total
                </Text>
              </Box>
              <ThemeIcon variant="light" size={38} radius="md" color="orange">
                <IconMail size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Active Jobs
                </Text>
                <Text size="2xl" fw={700} c="cyan.6">
                  {jobsStatus?.activeJobs?.length || 0}
                </Text>
              </Box>
              <ThemeIcon variant="light" size={38} radius="md" color="cyan">
                <IconLoader size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Sources Needing Scraping
                </Text>
                <Text size="2xl" fw={700} c="red.6">
                  {sourcesStatus?.sourcesNeedingScraping || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  of {sourcesStatus?.activeSources || 0} active
                </Text>
              </Box>
              <ThemeIcon variant="light" size={38} radius="md" color="red">
                <IconSearch size={18} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        {/* System Status */}
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
          {/* Active Jobs */}
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} size="lg" mb="md">
              <Group gap="xs">
                <IconLoader size={20} />
                Active Jobs
              </Group>
            </Title>

            {jobsStatus?.activeJobs && jobsStatus.activeJobs.length > 0 ? (
              <Stack gap="sm">
                {jobsStatus.activeJobs.map((job: any) => (
                  <Box key={job._id}>
                    <Group justify="space-between" align="flex-start">
                      <Box>
                        <Text fw={500} size="sm">
                          {job.kind === "batch_event_scrape"
                            ? "Batch Event Scraping"
                            : "Batch Source Scraping"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Started{" "}
                          {formatRelativeTimeBidirectional(job.startedAt)}
                        </Text>
                        {job.progress?.currentEvent && (
                          <Text size="xs" c="blue">
                            Current: {job.progress.currentEvent}
                          </Text>
                        )}
                        {job.progress?.currentSource && (
                          <Text size="xs" c="blue">
                            Current: {job.progress.currentSource}
                          </Text>
                        )}
                      </Box>
                      <Badge color={getStatusColor(job.status)} size="sm">
                        {job.status}
                      </Badge>
                    </Group>

                    {job.status === "running" && (
                      <Progress
                        value={
                          job.kind === "batch_event_scrape"
                            ? ((job.progress?.processedEvents || 0) /
                                (job.progress?.totalEvents || 1)) *
                              100
                            : ((job.progress?.processedSources || 0) /
                                (job.progress?.totalSources || 1)) *
                              100
                        }
                        size="sm"
                        mt="xs"
                        color={getStatusColor(job.status)}
                      />
                    )}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" ta="center" py="md">
                No active jobs running
              </Text>
            )}
          </Card>

          {/* Scheduled Operations */}
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} size="lg" mb="md">
              <Group gap="xs">
                <IconClock size={20} />
                Scheduled Operations
              </Group>
            </Title>

            <Stack gap="md">
              {/* Subscription Matching */}
              <Box>
                <Group justify="space-between" align="center" mb="xs">
                  <Text fw={500} size="sm">
                    Subscription Matching
                  </Text>
                  <Badge
                    color={
                      schedulingInfo?.upcomingMatching ? "green" : "yellow"
                    }
                    size="sm"
                  >
                    {schedulingInfo?.upcomingMatching || 0} scheduled
                  </Badge>
                </Group>
                {schedulingInfo?.overdueMatching &&
                  schedulingInfo.overdueMatching > 0 && (
                    <Text size="xs" c="red" mb="xs">
                      {schedulingInfo.overdueMatching} overdue matches
                    </Text>
                  )}
                {schedulingInfo?.nextMatches &&
                schedulingInfo.nextMatches.length > 0 ? (
                  <Text size="xs" c="dimmed">
                    Next: {schedulingInfo.nextMatches[0].title}{" "}
                    {formatRelativeTimeBidirectional(
                      schedulingInfo.nextMatches[0].scheduledAt!,
                    )}
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    No upcoming matches
                  </Text>
                )}
              </Box>

              <Divider />

              {/* Email Sending */}
              <Box>
                <Group justify="space-between" align="center" mb="xs">
                  <Text fw={500} size="sm">
                    Email Sending
                  </Text>
                  <Badge color="green" size="sm">
                    {workpoolsStatus?.subscriptionEmailWorkpool?.queuedJobs ||
                      0}{" "}
                    queued
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Runs automatically via workpool based on subscription
                  schedules
                </Text>
              </Box>

              <Divider />

              {/* Source Scraping */}
              <Box>
                <Group justify="space-between" align="center" mb="xs">
                  <Text fw={500} size="sm">
                    Source Scraping
                  </Text>
                  <Badge
                    color={
                      sourcesStatus?.sourcesNeedingScraping ? "red" : "green"
                    }
                    size="sm"
                  >
                    {sourcesStatus?.sourcesNeedingScraping || 0} due
                  </Badge>
                </Group>
                {sourcesStatus?.nextScrapingCandidates &&
                  sourcesStatus.nextScrapingCandidates.length > 0 && (
                    <Text size="xs" c="dimmed">
                      Next: {sourcesStatus.nextScrapingCandidates[0].name}
                      {sourcesStatus.nextScrapingCandidates[0]
                        .daysSinceLastScrape
                        ? ` (${sourcesStatus.nextScrapingCandidates[0].daysSinceLastScrape}d since last scrape)`
                        : " (never scraped)"}
                    </Text>
                  )}
              </Box>
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Quick Actions & Management */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} mb="md">
              Event Sources
            </Title>
            <Text c="dimmed" mb="lg">
              Manage the sources from which events are scraped
            </Text>

            {sourcesStatus && (
              <Stack gap="xs" mb="lg">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Total Sources:
                  </Text>
                  <Text fw={500}>{sourcesStatus.totalSources}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Active:
                  </Text>
                  <Text fw={500} c="green">
                    {sourcesStatus.activeSources}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Need Scraping:
                  </Text>
                  <Text fw={500} c="red">
                    {sourcesStatus.sourcesNeedingScraping}
                  </Text>
                </Group>
              </Stack>
            )}

            <Stack gap="sm">
              <Button
                onClick={onNavigateToSources}
                leftSection={<IconSettings size={16} />}
                fullWidth
              >
                Manage Sources
              </Button>

              <Button
                onClick={handleFixMissingSchedules}
                color="orange"
                fullWidth
                leftSection={<IconTool size={16} />}
                loading={isFixingSchedules}
              >
                {isFixingSchedules ? "Checking..." : "Fix Missing Schedules"}
              </Button>
            </Stack>
          </Card>

          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} mb="lg">
              System Operations
            </Title>
            <Stack gap="md">
              <Button
                onClick={() => {
                  setIsGeneratingEmbeddings(true);
                  generateMissingEmbeddings({})
                    .then((result) => {
                      notifications.show({
                        title: "Success",
                        message: `Generated embeddings for ${result.processed} events. ${result.failed} failed.`,
                        color: "green",
                      });
                    })
                    .catch(onApiError)
                    .finally(() => setIsGeneratingEmbeddings(false));
                }}
                disabled={isGeneratingEmbeddings}
                color="grape"
                fullWidth
                leftSection={<IconBrain size={16} />}
                loading={isGeneratingEmbeddings}
              >
                {isGeneratingEmbeddings
                  ? "Generating..."
                  : "Generate Missing Embeddings"}
              </Button>

              <Button
                onClick={onNavigateToSubscriptionDebug}
                color="orange"
                fullWidth
                leftSection={<IconMail size={16} />}
              >
                Debug Subscriptions
              </Button>

              <Button
                onClick={() => {
                  // Extract deployment ID from VITE_CONVEX_URL (e.g., "https://next-dragon-181.convex.cloud" -> "next-dragon-181")
                  const convexUrl = import.meta.env.VITE_CONVEX_URL;
                  const deploymentId = convexUrl?.split(".")[0]?.split("//")[1];
                  const dashboardUrl = deploymentId
                    ? `https://dashboard.convex.dev/d/${deploymentId}`
                    : "https://dashboard.convex.dev";
                  window.open(dashboardUrl, "_blank");
                }}
                color="blue"
                fullWidth
                leftSection={<IconExternalLink size={16} />}
              >
                Open Convex Dashboard
              </Button>

              <Button
                onClick={handleDeleteAllEvents}
                color="red"
                fullWidth
                leftSection={<IconTrash size={16} />}
                loading={isDeletingAllEvents}
              >
                {isDeletingAllEvents ? "Deleting..." : "Delete All Events"}
              </Button>

              <Button
                onClick={handleClearAllWorkpools}
                color="orange"
                fullWidth
                leftSection={<IconBrush size={16} />}
                loading={isClearingAllWorkpools}
              >
                {isClearingAllWorkpools ? "Clearing..." : "Clear All Workpools"}
              </Button>

              <Text size="xs" c="dimmed" ta="center">
                All operations are logged and can be monitored in real-time
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Workpools Status */}
        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Title order={3} size="lg" mb="md">
            <Group gap="xs">
              <IconCpu size={20} />
              Workpool Status
            </Group>
          </Title>

          {workpoolsStatus ? (
            <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
              {/* Event Scraping Workpool */}
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ cursor: "pointer" }}
                onClick={() => onNavigateToWorkpoolDebug("eventScrapeWorkpool")}
              >
                <Group justify="space-between" align="flex-start" mb="sm">
                  <Text size="xl">🕷️</Text>
                  <Badge color="yellow" size="sm">
                    {workpoolsStatus.eventScrapeWorkpool.queuedJobs} queued
                  </Badge>
                </Group>
                <Title order={4} size="md" mb="xs">
                  {workpoolsStatus.eventScrapeWorkpool.name}
                </Title>
                <Text size="sm" c="dimmed" mb="sm">
                  {workpoolsStatus.eventScrapeWorkpool.description}
                </Text>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Max: {workpoolsStatus.eventScrapeWorkpool.maxParallelism}
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    rightSection={<IconExternalLink size={12} />}
                  >
                    View Details
                  </Button>
                </Group>
              </Card>

              {/* Embedding Generation Workpool */}
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ cursor: "pointer" }}
                onClick={() =>
                  onNavigateToWorkpoolDebug("eventEmbeddingWorkpool")
                }
              >
                <Group justify="space-between" align="flex-start" mb="sm">
                  <Text size="xl">🧠</Text>
                  <Badge color="grape" size="sm">
                    {workpoolsStatus.eventEmbeddingWorkpool.queuedJobs} queued
                  </Badge>
                </Group>
                <Title order={4} size="md" mb="xs">
                  {workpoolsStatus.eventEmbeddingWorkpool.name}
                </Title>
                <Text size="sm" c="dimmed" mb="sm">
                  {workpoolsStatus.eventEmbeddingWorkpool.description}
                </Text>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Max: {workpoolsStatus.eventEmbeddingWorkpool.maxParallelism}
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    rightSection={<IconExternalLink size={12} />}
                  >
                    View Details
                  </Button>
                </Group>
              </Card>

              {/* Subscription Matching Workpool */}
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ cursor: "pointer" }}
                onClick={() =>
                  onNavigateToWorkpoolDebug("subscriptionMatchWorkpool")
                }
              >
                <Group justify="space-between" align="flex-start" mb="sm">
                  <Text size="xl">🎯</Text>
                  <Badge color="blue" size="sm">
                    {workpoolsStatus.subscriptionMatchWorkpool.queuedJobs}{" "}
                    queued
                  </Badge>
                </Group>
                <Title order={4} size="md" mb="xs">
                  {workpoolsStatus.subscriptionMatchWorkpool.name}
                </Title>
                <Text size="sm" c="dimmed" mb="sm">
                  {workpoolsStatus.subscriptionMatchWorkpool.description}
                </Text>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Max:{" "}
                    {workpoolsStatus.subscriptionMatchWorkpool.maxParallelism}
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    rightSection={<IconExternalLink size={12} />}
                  >
                    View Details
                  </Button>
                </Group>
              </Card>

              {/* Subscription Email Workpool */}
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ cursor: "pointer" }}
                onClick={() =>
                  onNavigateToWorkpoolDebug("subscriptionEmailWorkpool")
                }
              >
                <Group justify="space-between" align="flex-start" mb="sm">
                  <Text size="xl">📧</Text>
                  <Badge color="green" size="sm">
                    {workpoolsStatus.subscriptionEmailWorkpool?.queuedJobs || 0}{" "}
                    queued
                  </Badge>
                </Group>
                <Title order={4} size="md" mb="xs">
                  {workpoolsStatus.subscriptionEmailWorkpool?.name ||
                    "Subscription Email Sending"}
                </Title>
                <Text size="sm" c="dimmed" mb="sm">
                  {workpoolsStatus.subscriptionEmailWorkpool?.description ||
                    "Sends email notifications for subscription matches"}
                </Text>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Max:{" "}
                    {workpoolsStatus.subscriptionEmailWorkpool
                      ?.maxParallelism || 2}
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    rightSection={<IconExternalLink size={12} />}
                  >
                    View Details
                  </Button>
                </Group>
              </Card>
            </SimpleGrid>
          ) : (
            <Text c="dimmed" ta="center" py="md">
              Loading workpool status...
            </Text>
          )}
        </Card>

        {/* Recent Activity */}
        {jobsStatus?.recentJobs && jobsStatus.recentJobs.length > 0 && (
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} size="lg" mb="md">
              Recent System Activity (24h)
            </Title>
            <Stack gap="sm">
              {jobsStatus.recentJobs.map((job: any) => (
                <Group key={job._id} justify="space-between">
                  <Box>
                    <Text fw={500} size="sm">
                      {job.kind === "batch_event_scrape"
                        ? "Batch Event Scraping"
                        : "Batch Source Scraping"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatRelativeTimeBidirectional(job.startedAt)}
                      {job.completedAt &&
                        ` • Duration: ${Math.round((job.completedAt - job.startedAt) / 1000 / 60)}m`}
                    </Text>
                  </Box>
                  <Group gap="xs">
                    <Badge color={getStatusColor(job.status)} size="sm">
                      {job.status}
                    </Badge>
                    {job.status === "completed" && (
                      <ThemeIcon size="sm" color="green" variant="light">
                        <IconCheck size={12} />
                      </ThemeIcon>
                    )}
                    {job.status === "failed" && (
                      <ThemeIcon size="sm" color="red" variant="light">
                        <IconX size={12} />
                      </ThemeIcon>
                    )}
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

        {/* Notification Testing */}
        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Title order={3} mb="lg">
            🔔 Notification Testing
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            Test different types of notifications to ensure they're working
            properly
          </Text>
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
            <Button
              onClick={() => {
                notifications.show({
                  title: "Success!",
                  message: "This is a success notification",
                  color: "green",
                });
              }}
              color="green"
              leftSection={<IconBell size={16} />}
              size="sm"
            >
              Success
            </Button>

            <Button
              onClick={() => {
                notifications.show({
                  title: "Error!",
                  message: "This is an error notification",
                  color: "red",
                });
              }}
              color="red"
              leftSection={<IconBellRinging size={16} />}
              size="sm"
            >
              Error
            </Button>

            <Button
              onClick={() => {
                notifications.show({
                  title: "Warning!",
                  message: "This is a warning notification",
                  color: "yellow",
                });
              }}
              color="yellow"
              leftSection={<IconBell size={16} />}
              size="sm"
            >
              Warning
            </Button>

            <Button
              onClick={() => {
                notifications.show({
                  title: "Info",
                  message: "This is an info notification",
                  color: "blue",
                });
              }}
              color="blue"
              leftSection={<IconBell size={16} />}
              size="sm"
            >
              Info
            </Button>
          </SimpleGrid>

          <Divider my="md" />

          <Button
            onClick={() => {
              notifications.show({
                id: "test-loading",
                title: "Loading...",
                message: "This notification will update in 2 seconds",
                color: "blue",
                loading: true,
                autoClose: false,
              });

              setTimeout(() => {
                notifications.update({
                  id: "test-loading",
                  title: "Complete!",
                  message: "The loading notification has been updated",
                  color: "green",
                  loading: false,
                  autoClose: 5000,
                });
              }, 2000);
            }}
            variant="light"
            fullWidth
            leftSection={<IconBellRinging size={16} />}
            size="sm"
          >
            Test Loading → Success Update
          </Button>
        </Card>
      </Stack>
    </Container>
  );
}
