import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { useAPIErrorHandler } from "../utils/hooks";
import { formatDate, formatRelativeTime } from "../utils/dateUtils";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Badge,
  Textarea,
  SimpleGrid,
  Loader,
  Center,
  Box,
  ActionIcon,
  Divider,
} from "@mantine/core";
import {
  IconMail,
  IconEdit,
  IconTrash,
  IconPlayerPause,
  IconPlayerPlay,
  IconArrowLeft,
  IconPlus,
  IconClock,
  IconCalendar,
} from "@tabler/icons-react";

interface SubscriptionsPageProps {
  onCreateNew: () => void;
}

export function SubscriptionsPage({ onCreateNew }: SubscriptionsPageProps) {
  const subscriptions = useQuery(api.subscriptions.list);
  const updateSubscription = useMutation(api.subscriptions.update);
  const deleteSubscription = useMutation(api.subscriptions.remove);
  const sendEmailNow = useAction(api.emailSending.sendSubscriptionEmail);

  const [editingId, setEditingId] = useState<Id<"subscriptions"> | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [sendingEmailFor, setSendingEmailFor] =
    useState<Id<"subscriptions"> | null>(null);

  const onApiError = useAPIErrorHandler();

  const handleEdit = (subscription: {
    _id: Id<"subscriptions">;
    prompt: string;
  }) => {
    setEditingId(subscription._id);
    setEditPrompt(subscription.prompt);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditPrompt("");
  };

  if (subscriptions === undefined) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={1} size="2.5rem">
            Event Subscriptions
          </Title>
          <Text c="dimmed" mt="xs">
            Manage your event notification preferences
          </Text>
        </Box>
        <Button onClick={onCreateNew} size="lg">
          + Create Subscription
        </Button>
      </Group>

      {subscriptions.length === 0 ? (
        <Card
          shadow="sm"
          padding="xl"
          radius="lg"
          style={{ textAlign: "center" }}
        >
          <Text size="4rem" style={{ marginBottom: "1rem" }}>
            📧
          </Text>
          <Title order={3} mb="xs">
            No subscriptions yet
          </Title>
          <Text c="dimmed" mb="lg">
            Create your first subscription to get notified about events that
            match your interests
          </Text>
          <Button onClick={onCreateNew} size="lg">
            Create Your First Subscription
          </Button>
        </Card>
      ) : (
        <Stack gap="lg">
          {subscriptions.map((subscription: any) => (
            <Card
              key={subscription._id}
              shadow="sm"
              padding="xl"
              radius="lg"
              withBorder
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
                    <Badge
                      color={subscription.isActive ? "green" : "gray"}
                      size="sm"
                    >
                      {subscription.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {subscription.totalQueuedEvents > 0 && (
                      <Badge color="blue" size="sm">
                        {subscription.totalQueuedEvents} queued event
                        {subscription.totalQueuedEvents > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </Group>

                  {editingId === subscription._id ? (
                    <Stack gap="sm">
                      <Textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={3}
                        autosize
                      />
                      <Group gap="xs">
                        <Button
                          onClick={() => {
                            updateSubscription({
                              id: subscription._id,
                              prompt: editPrompt,
                            })
                              .then(() => {
                                setEditingId(null);
                                toast.success("Subscription updated");
                              })
                              .catch(onApiError);
                          }}
                          color="green"
                          size="sm"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="default"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </Group>
                    </Stack>
                  ) : (
                    <Stack gap="md">
                      <Text size="md" style={{ lineHeight: 1.6 }}>
                        "{subscription.prompt}"
                      </Text>

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
                            fw={
                              subscription.nextEmailScheduled <= Date.now()
                                ? 500
                                : 400
                            }
                          >
                            {formatRelativeTime(
                              subscription.nextEmailScheduled,
                            )}
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
                                    {queueItem.event?.title ||
                                      "Event not found"}
                                  </Text>
                                  <Text size="xs" c="blue.6">
                                    ({(queueItem.matchScore * 100).toFixed(0)}%
                                    match)
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
                                ... and {subscription.totalQueuedEvents - 5}{" "}
                                more
                              </Text>
                            )}
                          </Stack>
                        </Card>
                      )}
                    </Stack>
                  )}
                </Box>

                <Stack gap="xs" style={{ minWidth: "120px" }}>
                  {subscription.totalQueuedEvents > 0 && (
                    <Button
                      onClick={() => {
                        setSendingEmailFor(subscription._id);
                        sendEmailNow({
                          subscriptionId: subscription._id,
                        })
                          .then((result) => {
                            if (result.success) {
                              toast.success(
                                `Email sent successfully! ${result.eventsSent} events included.`,
                              );
                            } else {
                              toast.error(result.message);
                            }
                          })
                          .catch(onApiError)
                          .finally(() => setSendingEmailFor(null));
                      }}
                      loading={sendingEmailFor === subscription._id}
                      color="green"
                      size="sm"
                      leftSection={<IconMail size={16} />}
                    >
                      {sendingEmailFor === subscription._id
                        ? "Sending..."
                        : "Send Now"}
                    </Button>
                  )}

                  <Button
                    onClick={() =>
                      updateSubscription({
                        id: subscription._id,
                        isActive: !subscription.isActive,
                      })
                        .then(() => {
                          toast.success(
                            `Subscription ${!subscription.isActive ? "activated" : "deactivated"}`,
                          );
                        })
                        .catch(onApiError)
                    }
                    variant="light"
                    color={subscription.isActive ? "yellow" : "green"}
                    size="sm"
                    leftSection={
                      subscription.isActive ? (
                        <IconPlayerPause size={16} />
                      ) : (
                        <IconPlayerPlay size={16} />
                      )
                    }
                  >
                    {subscription.isActive ? "Pause" : "Activate"}
                  </Button>

                  {editingId !== subscription._id && (
                    <Button
                      onClick={() => handleEdit(subscription)}
                      variant="light"
                      color="blue"
                      size="sm"
                      leftSection={<IconEdit size={16} />}
                    >
                      Edit
                    </Button>
                  )}

                  <Button
                    onClick={() => {
                      if (
                        !confirm(
                          "Are you sure you want to delete this subscription?",
                        )
                      )
                        return;

                      deleteSubscription({ id: subscription._id })
                        .then(() => toast.success("Subscription deleted"))
                        .catch(onApiError);
                    }}
                    variant="light"
                    color="red"
                    size="sm"
                    leftSection={<IconTrash size={16} />}
                  >
                    Delete
                  </Button>
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
