import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  Title,
  Text,
  SimpleGrid,
  Box,
  Loader,
  Center,
} from "@mantine/core";

export function SubscriptionStats() {
  const stats = useQuery(api.subscriptions.subscriptionsAdmin.getSubscriptionStats);

  if (stats === undefined) {
    return (
      <Card shadow="sm" padding="xl" radius="lg" withBorder>
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      </Card>
    );
  }

  return (
    <Card shadow="sm" padding="xl" radius="lg" withBorder>
      <Title order={2} mb="lg">
        Subscription Statistics
      </Title>

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="lg">
        <Box ta="center">
          <Text size="2xl" fw={700} c="blue.6">
            {stats.total}
          </Text>
          <Text size="sm" c="dimmed">
            Total Subscriptions
          </Text>
        </Box>

        <Box ta="center">
          <Text size="2xl" fw={700} c="green.6">
            {stats.active}
          </Text>
          <Text size="sm" c="dimmed">
            Active
          </Text>
        </Box>

        <Box ta="center">
          <Text size="2xl" fw={700} c="gray.6">
            {stats.inactive}
          </Text>
          <Text size="sm" c="dimmed">
            Inactive
          </Text>
        </Box>

        <Box ta="center">
          <Text size="2xl" fw={700} c="orange.6">
            {stats.totalQueuedEvents}
          </Text>
          <Text size="sm" c="dimmed">
            Queued Events
          </Text>
        </Box>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt="lg">
        <Box ta="center">
          <Text size="lg" fw={600} c="violet.6">
            {stats.readyForEmail}
          </Text>
          <Text size="sm" c="dimmed">
            Ready for Email
          </Text>
        </Box>

        <Box ta="center">
          <Text size="lg" fw={600} c="teal.6">
            {stats.uniqueUsers}
          </Text>
          <Text size="sm" c="dimmed">
            Unique Users
          </Text>
        </Box>

        <Box ta="center">
          <Text size="lg" fw={600} c="pink.6">
            {(stats.avgEmailFrequency || 0).toFixed(1)}h
          </Text>
          <Text size="sm" c="dimmed">
            Avg Email Frequency
          </Text>
        </Box>
      </SimpleGrid>
    </Card>
  );
} 