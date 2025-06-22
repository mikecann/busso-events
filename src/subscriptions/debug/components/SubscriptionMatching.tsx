import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { useAPIErrorHandler } from "../../../utils/hooks";
import {
  formatDateDetailed as formatDate,
  formatSchedulingTime,
} from "../../../utils/dateUtils";
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Box,
  SimpleGrid,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface DebugSectionProps {
  eventId: Id<"events">;
}

export function SubscriptionMatching({ eventId }: DebugSectionProps) {
  const event = useQuery(api.events.events.getById, { id: eventId });
  const triggerSubscriptionMatching = useAction(
    api.subscriptions.subscriptionsMatching.triggerSubscriptionMatchingForEvent,
  );

  const [isTriggeringMatching, setIsTriggeringMatching] = useState(false);
  const onApiError = useAPIErrorHandler();

  if (!event) return null;

  return (
    <Card shadow="sm" padding="xl" radius="lg" withBorder>
      <Group justify="space-between" align="center" mb="lg">
        <Title order={2}>Subscription Matching</Title>
        <Button
          onClick={() => {
            setIsTriggeringMatching(true);
            triggerSubscriptionMatching({
              eventId,
            })
              .then((result) => {
                if (result.success) {
                  toast.success("Subscription matching triggered successfully");
                } else {
                  toast.error("Failed to trigger subscription matching");
                }
              })
              .catch(onApiError)
              .finally(() => setIsTriggeringMatching(false));
          }}
          disabled={isTriggeringMatching}
          leftSection={<IconRefresh size={16} />}
          loading={isTriggeringMatching}
        >
          {isTriggeringMatching ? "Triggering..." : "Trigger Now"}
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="lg">
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Scheduled Job ID:
          </Text>
          <Text ff="monospace" size="sm">
            {event.subscriptionMatchScheduledId || "Not scheduled"}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Scheduled For:
          </Text>
          <Text
            size="sm"
            c={
              event.subscriptionMatchScheduledAt &&
              event.subscriptionMatchScheduledAt <= Date.now()
                ? "green.6"
                : undefined
            }
            fw={
              event.subscriptionMatchScheduledAt &&
              event.subscriptionMatchScheduledAt <= Date.now()
                ? 500
                : undefined
            }
          >
            {event.subscriptionMatchScheduledAt
              ? `${formatDate(event.subscriptionMatchScheduledAt)} (${formatSchedulingTime(event.subscriptionMatchScheduledAt)})`
              : "Not scheduled"}
          </Text>
        </Box>
      </SimpleGrid>

      <Card bg="blue.0" padding="md" radius="md">
        <Text size="sm" c="blue.8">
          💡{" "}
          <Text span fw={500}>
            Subscription matching
          </Text>{" "}
          runs automatically 8 hours after an event is created or updated. It
          checks this event against all active user subscriptions and adds
          matching events to email queues.
        </Text>
      </Card>
    </Card>
  );
}
