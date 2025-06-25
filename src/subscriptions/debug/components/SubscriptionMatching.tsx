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
  Box,
  SimpleGrid,
  Badge,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface DebugSectionProps {
  eventId: Id<"events">;
}

export function SubscriptionMatching({ eventId }: DebugSectionProps) {
  const subscriptionMatchWorkpoolStatus = useQuery(
    api.events.events.getSubscriptionMatchWorkpoolStatus,
    { eventId },
  );
  const triggerSubscriptionMatching = useAction(
    api.subscriptions.subscriptionsMatching.triggerSubscriptionMatchingForEvent,
  );

  const [isTriggeringMatching, setIsTriggeringMatching] = useState(false);
  const onApiError = useAPIErrorHandler();

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
                  notifications.show({
                    message: "Subscription matching triggered successfully",
                    color: "green",
                  });
                } else {
                  notifications.show({
                    message: "Failed to trigger subscription matching",
                    color: "red",
                  });
                }
              })
              .catch(onApiError)
              .finally(() => setIsTriggeringMatching(false));
          }}
          disabled={isTriggeringMatching}
          color="blue"
          leftSection={<IconRefresh size={16} />}
          loading={isTriggeringMatching}
        >
          {isTriggeringMatching ? "Triggering..." : "Trigger Now"}
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" mb="lg">
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Workpool ID:
          </Text>
          <Text ff="monospace" size="sm">
            {subscriptionMatchWorkpoolStatus?.workId || "Not queued"}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Enqueued At:
          </Text>
          <Text size="sm">
            {subscriptionMatchWorkpoolStatus?.enqueuedAt
              ? formatDate(subscriptionMatchWorkpoolStatus.enqueuedAt)
              : "Not queued"}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Status:
          </Text>
          <Text size="sm">
            {subscriptionMatchWorkpoolStatus?.status ? (
              <Badge
                color={
                  subscriptionMatchWorkpoolStatus.status.state === "pending"
                    ? "yellow"
                    : subscriptionMatchWorkpoolStatus.status.state === "running"
                      ? "blue"
                      : subscriptionMatchWorkpoolStatus.status.state ===
                          "finished"
                        ? "green"
                        : "red"
                }
              >
                {subscriptionMatchWorkpoolStatus.status.state}
                {subscriptionMatchWorkpoolStatus.status.retryCount !==
                  undefined &&
                  subscriptionMatchWorkpoolStatus.status.retryCount > 0 && (
                    <span>
                      {" "}
                      (Retries:{" "}
                      {subscriptionMatchWorkpoolStatus.status.retryCount})
                    </span>
                  )}
              </Badge>
            ) : subscriptionMatchWorkpoolStatus?.error ? (
              <Badge color="red">
                Error: {subscriptionMatchWorkpoolStatus.error}
              </Badge>
            ) : (
              <Badge color="gray">Not queued</Badge>
            )}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Queue Position:
          </Text>
          <Text size="sm">
            {subscriptionMatchWorkpoolStatus?.status?.state === "pending" &&
            subscriptionMatchWorkpoolStatus.status.queuePosition !== undefined
              ? `#${subscriptionMatchWorkpoolStatus.status.queuePosition + 1}`
              : ""}
          </Text>
        </Box>
      </SimpleGrid>

      <Card bg="blue.0" padding="md" radius="md">
        <Text size="sm" c="blue.8">
          🎯{" "}
          <Text span fw={500}>
            Subscription matching
          </Text>{" "}
          is automatically queued in a workpool 8 hours after an event is
          created or updated. The workpool processes subscription matching jobs
          with a maximum parallelism of 1 to ensure consistent processing. It
          checks this event against all active user subscriptions and adds
          matching events to email queues.
        </Text>
      </Card>
    </Card>
  );
}
