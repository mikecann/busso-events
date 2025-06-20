import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
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
} from "@tabler/icons-react";

interface AppAdminPageProps {
  onNavigateToSources: () => void;
}

export function AppAdminPage({ onNavigateToSources }: AppAdminPageProps) {
  const eventsReadyForScraping = useQuery(
    api.eventsAdmin.getEventsReadyForScraping,
  );
  const generateMissingEmbeddings = useAction(
    api.embeddings.generateMissingEmbeddings,
  );
  const queueStats = useQuery(api.emailQueue.getQueueStats);
  const jobsStatus = useQuery(api.jobs.getSystemStatus);
  const schedulingInfo = useQuery(api.eventsAdmin.getSchedulingInfo);
  const sourcesStatus = useQuery(api.eventSources.getSourcesStatus);

  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);

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
                  <Badge color="blue" size="sm">
                    Automated (24h cycle)
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Runs automatically via cron job every day
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

            <Button
              onClick={onNavigateToSources}
              leftSection={<IconSettings size={16} />}
              fullWidth
            >
              Manage Sources
            </Button>
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
                      toast.success(
                        `Generated embeddings for ${result.processed} events. ${result.failed} failed.`,
                      );
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

              <Text size="xs" c="dimmed" ta="center">
                All operations are logged and can be monitored in real-time
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>

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
      </Stack>
    </Container>
  );
}
