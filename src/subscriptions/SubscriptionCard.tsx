import { Doc } from "../../convex/_generated/dataModel";
import { formatDate, formatRelativeTime } from "../utils/dateUtils";
import {
  Card,
  Stack,
  Group,
  Badge,
  Text,
  Box,
  SimpleGrid,
  Title,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";

interface SubscriptionCardProps {
  subscription: Doc<"subscriptions"> & {
    queuedEvents: any[];
    totalQueuedEvents: number;
    nextEmailScheduled: number;
    emailFrequencyHours: number;
  };
  onClick: () => void;
}

export function SubscriptionCard({
  subscription,
  onClick,
}: SubscriptionCardProps) {
  const isPromptSubscription =
    (subscription as any).kind === "prompt" ||
    (subscription as any).prompt !== undefined;
  const isAllEventsSubscription = (subscription as any).kind === "all_events";

  return (
    <Card
      shadow="sm"
      padding="xl"
      radius="lg"
      withBorder
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      <Group align="flex-start" justify="space-between">
        <Box style={{ flex: 1 }}>
          <Group gap="sm" mb="sm">
            <Box
              w={12}
              h={12}
              bg={subscription.isActive ? "green.5" : "gray.4"}
              style={{ borderRadius: "50%" }}
            />
            <Badge color={subscription.isActive ? "green" : "gray"} size="sm">
              {subscription.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge
              color={isAllEventsSubscription ? "purple" : "orange"}
              size="sm"
            >
              {isAllEventsSubscription ? "All Events" : "Prompt-based"}
            </Badge>
            {subscription.totalQueuedEvents > 0 && (
              <Badge color="blue" size="sm">
                {subscription.totalQueuedEvents} queued event
                {subscription.totalQueuedEvents > 1 ? "s" : ""}
              </Badge>
            )}
          </Group>

          <Stack gap="md">
            {isPromptSubscription ? (
              <Text size="md" style={{ lineHeight: 1.6 }}>
                "{(subscription as any).prompt}"
              </Text>
            ) : (
              <Text size="md" style={{ lineHeight: 1.6 }} c="purple.7">
                Subscribed to all events
              </Text>
            )}

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Box>
                <Text fw={500} size="sm">
                  Email frequency:
                </Text>
                <Text size="sm" c="dimmed">
                  {subscription.emailFrequencyHours}h
                </Text>
              </Box>
              <Box>
                <Text fw={500} size="sm">
                  Last email:
                </Text>
                <Text size="sm" c="dimmed">
                  {subscription.lastEmailSent
                    ? formatDate(subscription.lastEmailSent)
                    : "Never"}
                </Text>
              </Box>
              <Box>
                <Text fw={500} size="sm">
                  Next email:
                </Text>
                <Text
                  size="sm"
                  c={
                    subscription.nextEmailScheduled <= Date.now()
                      ? "green"
                      : "dimmed"
                  }
                  fw={subscription.nextEmailScheduled <= Date.now() ? 500 : 400}
                >
                  {formatRelativeTime(subscription.nextEmailScheduled)}
                </Text>
              </Box>
            </SimpleGrid>

            {subscription.queuedEvents.length > 0 && (
              <Card withBorder radius="md" bg="blue.0">
                <Title order={4} c="blue.9" mb="sm">
                  Queued Events ({subscription.totalQueuedEvents})
                </Title>
                <Stack gap="xs">
                  {subscription.queuedEvents.map((queueItem: any) => (
                    <Box key={queueItem._id}>
                      <Group gap="xs" align="center">
                        <Text fw={500} size="sm" c="blue.8">
                          {queueItem.event?.title || "Event not found"}
                        </Text>
                        <Text size="xs" c="blue.6">
                          ({(queueItem.matchScore * 100).toFixed(0)}% match)
                        </Text>
                      </Group>
                      <Text size="xs" c="blue.6">
                        📅{" "}
                        {queueItem.event
                          ? formatDate(queueItem.event.eventDate)
                          : "Unknown date"}
                      </Text>
                    </Box>
                  ))}
                  {subscription.totalQueuedEvents > 5 && (
                    <Text size="xs" c="blue.6">
                      ... and {subscription.totalQueuedEvents - 5} more
                    </Text>
                  )}
                </Stack>
              </Card>
            )}
          </Stack>
        </Box>

        <IconChevronRight size={20} color="var(--mantine-color-dimmed)" />
      </Group>
    </Card>
  );
}
