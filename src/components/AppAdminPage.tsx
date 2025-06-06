import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { useAPIErrorHandler } from "../utils/hooks";
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
} from "@mantine/core";
import { IconBrain, IconSettings } from "@tabler/icons-react";

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

  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);

  const onApiError = useAPIErrorHandler();

  return (
    <Container size="xl">
      <Stack gap="xl">
        <Box>
          <Title order={1} size="2.5rem">
            Admin Dashboard
          </Title>
          <Text c="dimmed" mt="xs">
            Manage events, sources, and system operations
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
          {/* Events Ready for Scraping */}
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} size="lg" mb="sm">
              Events Ready for Scraping
            </Title>
            <Text size="2.5rem" fw={700} c="blue.6" mb="sm">
              {eventsReadyForScraping?.length || 0}
            </Text>
            <Text size="sm" c="dimmed">
              Events that haven't been scraped in the last 24 hours
            </Text>
          </Card>

          {/* Email Queue Stats */}
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} size="lg" mb="sm">
              Email Queue
            </Title>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Unsent:
                </Text>
                <Text fw={500} c="orange.6">
                  {queueStats?.unsent || 0}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Sent:
                </Text>
                <Text fw={500} c="green.6">
                  {queueStats?.sent || 0}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Total:
                </Text>
                <Text fw={500}>{queueStats?.total || 0}</Text>
              </Group>
            </Stack>
          </Card>

          {/* Quick Actions */}
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} size="lg" mb="lg">
              Quick Actions
            </Title>
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
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {/* Event Sources Management */}
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} mb="md">
              Event Sources
            </Title>
            <Text c="dimmed" mb="lg">
              Manage the sources from which events are scraped
            </Text>
            <Button
              onClick={onNavigateToSources}
              leftSection={<IconSettings size={16} />}
            >
              Manage Sources
            </Button>
          </Card>

          {/* System Health */}
          <Card shadow="sm" padding="xl" radius="lg" withBorder>
            <Title order={3} mb="lg">
              System Health
            </Title>
            <Stack gap="md">
              <Group justify="space-between">
                <Text c="dimmed">Scraping System:</Text>
                <Badge color="green" size="sm">
                  Active
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text c="dimmed">Email System:</Text>
                <Badge color="green" size="sm">
                  Active
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text c="dimmed">Embeddings:</Text>
                <Badge color="green" size="sm">
                  Active
                </Badge>
              </Group>
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
