import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useAPIErrorHandler } from "../../../utils/hooks";
import { formatDate } from "../../../utils/dateUtils";
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Box,
  Stack,
  SimpleGrid,
  Badge,
  Loader,
} from "@mantine/core";
import { IconRefresh, IconMail } from "@tabler/icons-react";

// Type guards for subscription types
function isPromptSubscription(
  subscription: any,
): subscription is any & { prompt: string; kind: "prompt" } {
  return (
    subscription.kind === "prompt" ||
    (subscription.prompt !== undefined && subscription.kind !== "all_events")
  );
}

function isAllEventsSubscription(subscription: any): boolean {
  return subscription.kind === "all_events";
}

interface SubscriptionMatchingTestProps {
  subscriptionId: Id<"subscriptions">;
}

export function SubscriptionMatchingTest({
  subscriptionId,
}: SubscriptionMatchingTestProps) {
  const allSubscriptions = useQuery(
    api.subscriptions.subscriptionsAdmin.getAllSubscriptions,
  );
  const subscription = allSubscriptions?.find(
    (sub: any) => sub._id === subscriptionId,
  );
  const testMatching = useAction(
    api.subscriptions.subscriptionsAdmin.testSubscriptionMatching,
  );
  const previewMatching = useAction(
    api.subscriptions.subscriptionsMatching.previewMatchingEvents,
  );

  const [isTestingMatching, setIsTestingMatching] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewEvents, setPreviewEvents] = useState<any[] | null>(null);

  const onApiError = useAPIErrorHandler();

  if (allSubscriptions === undefined) {
    return (
      <Card shadow="sm" padding="xl" radius="lg" withBorder>
        <Loader size="lg" />
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card shadow="sm" padding="xl" radius="lg" withBorder>
        <Text c="dimmed" ta="center" py="xl">
          Subscription not found
        </Text>
      </Card>
    );
  }

  const loadPreview = () => {
    if (!isPromptSubscription(subscription)) {
      toast.error("Preview is only available for prompt-based subscriptions");
      return;
    }

    setIsLoadingPreview(true);
    previewMatching({ prompt: (subscription as any).prompt })
      .then((events) => setPreviewEvents(events))
      .catch(onApiError)
      .finally(() => setIsLoadingPreview(false));
  };

  return (
    <Card shadow="sm" padding="xl" radius="lg" withBorder>
      <Group justify="space-between" align="center" mb="lg">
        <Title order={2}>Subscription Matching Test</Title>
        <Group gap="xs">
          {isPromptSubscription(subscription) && (
            <Button
              onClick={loadPreview}
              disabled={isLoadingPreview}
              leftSection={<IconRefresh size={16} />}
              loading={isLoadingPreview}
              variant="light"
            >
              Preview Matches
            </Button>
          )}
          <Button
            onClick={() => {
              setIsTestingMatching(true);
              testMatching({ subscriptionId })
                .then((result) => {
                  if (result) {
                    toast.success("Matching test completed successfully");
                  } else {
                    toast.error("Subscription not found");
                  }
                })
                .catch(onApiError)
                .finally(() => setIsTestingMatching(false));
            }}
            disabled={isTestingMatching}
            leftSection={<IconMail size={16} />}
            loading={isTestingMatching}
          >
            Test Matching
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="lg">
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Subscription Type:
          </Text>
          <Text size="sm" style={{ lineHeight: 1.6 }}>
            {isPromptSubscription(subscription) ? (
              <>
                <Badge color="orange" size="sm" mr="xs">
                  Prompt-based
                </Badge>
                <br />"{(subscription as any).prompt}"
              </>
            ) : (
              <Badge color="purple" size="sm">
                All Events
              </Badge>
            )}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Status:
          </Text>
          <Badge color={subscription.isActive ? "green" : "gray"} size="sm">
            {subscription.isActive ? "Active" : "Inactive"}
          </Badge>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Email Frequency:
          </Text>
          <Text size="sm">{subscription.emailFrequencyHours}h</Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Last Email:
          </Text>
          <Text size="sm">
            {subscription.lastEmailSent
              ? formatDate(subscription.lastEmailSent)
              : "Never"}
          </Text>
        </Box>
      </SimpleGrid>

      {previewEvents && (
        <Box>
          <Title order={3} mb="md">
            Preview Results ({previewEvents.length} events)
          </Title>
          {previewEvents.length > 0 ? (
            <Stack gap="sm">
              {previewEvents.slice(0, 5).map((event: any) => (
                <Card key={event._id} withBorder padding="sm" radius="md">
                  <Group justify="space-between">
                    <Box style={{ flex: 1 }}>
                      <Text fw={500} size="sm" lineClamp={1}>
                        {event.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        📅 {formatDate(event.eventDate)}
                      </Text>
                    </Box>
                    <Group gap="xs">
                      <Badge
                        color={
                          event.score >= 0.8
                            ? "green"
                            : event.score >= 0.6
                              ? "yellow"
                              : "red"
                        }
                        size="xs"
                      >
                        {(event.score * 100).toFixed(0)}%
                      </Badge>
                      <Badge
                        color={
                          event.matchType === "semantic" ? "blue" : "grape"
                        }
                        size="xs"
                      >
                        {event.matchType}
                      </Badge>
                      {event.meetsThreshold && (
                        <Badge color="green" size="xs">
                          ✓ Match
                        </Badge>
                      )}
                    </Group>
                  </Group>
                </Card>
              ))}
              {previewEvents.length > 5 && (
                <Text size="sm" c="dimmed" ta="center">
                  ... and {previewEvents.length - 5} more events
                </Text>
              )}
            </Stack>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              No matching events found
            </Text>
          )}
        </Box>
      )}

      <Card bg="blue.0" padding="md" radius="md" mt="lg">
        <Text size="sm" c="blue.8">
          💡{" "}
          <Text span fw={500}>
            Preview Matches
          </Text>{" "}
          shows what events would match this subscription based on current data.{" "}
          <Text span fw={500}>
            Test Matching
          </Text>{" "}
          runs the actual matching algorithm and processes any matches found.
        </Text>
      </Card>
    </Card>
  );
}
