import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  TextInput,
  Box,
  Badge,
} from "@mantine/core";
import { IconArrowLeft, IconSearch } from "@tabler/icons-react";
import { SubscriptionMatchingTest } from "./components/SubscriptionMatchingTest";
import { SubscriptionStats } from "./components/SubscriptionStats";

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

interface SubscriptionDebugPageProps {
  onBack: () => void;
}

export function SubscriptionDebugPage({ onBack }: SubscriptionDebugPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubscriptionId, setSelectedSubscriptionId] =
    useState<Id<"subscriptions"> | null>(null);

  const subscriptions = useQuery(
    api.subscriptions.subscriptionsAdmin.getAllSubscriptions,
  );

  const filteredSubscriptions = subscriptions?.filter((sub: any) => {
    const promptMatch = isPromptSubscription(sub)
      ? (sub as any).prompt.toLowerCase().includes(searchQuery.toLowerCase())
      : false;
    const userIdMatch = sub.userId
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    const typeMatch =
      searchQuery.toLowerCase().includes("all events") &&
      isAllEventsSubscription(sub);

    return promptMatch || userIdMatch || typeMatch;
  });

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="subtle"
            onClick={onBack}
          >
            Back to Admin
          </Button>
          <Title order={1}>Subscription Debug</Title>
        </Group>

        <SubscriptionStats />

        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Title order={2} mb="lg">
            Search Subscriptions
          </Title>
          <TextInput
            placeholder="Search by prompt or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftSection={<IconSearch size={16} />}
            mb="lg"
          />

          {filteredSubscriptions && filteredSubscriptions.length > 0 ? (
            <Stack gap="sm">
              {filteredSubscriptions.map((subscription: any) => (
                <Card
                  key={subscription._id}
                  withBorder
                  padding="md"
                  radius="md"
                  style={{
                    cursor: "pointer",
                    backgroundColor:
                      selectedSubscriptionId === subscription._id
                        ? "var(--mantine-color-blue-0)"
                        : undefined,
                  }}
                  onClick={() => setSelectedSubscriptionId(subscription._id)}
                >
                  <Group justify="space-between">
                    <Box>
                      <Text fw={500} size="sm" lineClamp={1}>
                        {isPromptSubscription(subscription) ? (
                          <>
                            <Badge color="orange" size="xs" mr="xs">
                              Prompt
                            </Badge>
                            {(subscription as any).prompt}
                          </>
                        ) : (
                          <>
                            <Badge color="purple" size="xs" mr="xs">
                              All Events
                            </Badge>
                            All Events Subscription
                          </>
                        )}
                      </Text>
                      <Text size="xs" c="dimmed">
                        User: {subscription.userId} | Status:{" "}
                        {subscription.isActive ? "Active" : "Inactive"}
                      </Text>
                    </Box>
                    <Text size="xs" c="dimmed">
                      {subscription.emailFrequencyHours}h frequency
                    </Text>
                  </Group>
                </Card>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              No subscriptions found
            </Text>
          )}
        </Card>

        {selectedSubscriptionId && (
          <SubscriptionMatchingTest subscriptionId={selectedSubscriptionId} />
        )}
      </Stack>
    </Container>
  );
}
