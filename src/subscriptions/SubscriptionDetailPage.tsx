import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { notifications } from "@mantine/notifications";
import { useAPIErrorHandler } from "../utils/hooks";
import { formatDate, formatRelativeTime } from "../utils/dateUtils";
import { EventDescription } from "../events/EventDescription";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Badge,
  Box,
  SimpleGrid,
  Loader,
  Center,
  Textarea,
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
  IconCheck,
  IconX,
} from "@tabler/icons-react";

interface SubscriptionDetailPageProps {
  subscriptionId: Id<"subscriptions">;
  onBack: () => void;
}

export function SubscriptionDetailPage({
  subscriptionId,
  onBack,
}: SubscriptionDetailPageProps) {
  const subscription = useQuery(api.subscriptions.subscriptions.get, {
    subscriptionId,
  });

  const updateSubscription = useMutation(
    api.subscriptions.subscriptions.update,
  );
  const deleteSubscription = useMutation(
    api.subscriptions.subscriptions.remove,
  );
  const sendEmailNow = useAction(api.emailSending.sendSubscriptionEmail);

  const [editingPrompt, setEditingPrompt] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const onApiError = useAPIErrorHandler();

  if (subscription === undefined) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  if (subscription === null) {
    return (
      <Container size="lg">
        <Group gap="md" mb="xl">
          <ActionIcon variant="subtle" onClick={onBack}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={1}>Subscription Not Found</Title>
        </Group>
        <Text>
          The subscription you're looking for doesn't exist or you don't have
          access to it.
        </Text>
      </Container>
    );
  }

  const isPromptSubscription =
    (subscription as any).kind === "prompt" ||
    (subscription as any).prompt !== undefined;
  const isAllEventsSubscription = (subscription as any).kind === "all_events";

  const handleEditPrompt = () => {
    setEditingPrompt(true);
    setEditPrompt((subscription as any).prompt || "");
  };

  const handleSavePrompt = () => {
    updateSubscription({
      id: subscription._id,
      prompt: editPrompt,
    })
      .then(() => {
        setEditingPrompt(false);
        notifications.show({
          title: "Success",
          message: "Subscription updated",
          color: "green",
        });
      })
      .catch(onApiError);
  };

  const handleCancelEdit = () => {
    setEditingPrompt(false);
    setEditPrompt("");
  };

  const handleToggleActive = () => {
    updateSubscription({
      id: subscription._id,
      isActive: !subscription.isActive,
    })
      .then(() => {
        notifications.show({
          title: "Success",
          message: `Subscription ${!subscription.isActive ? "activated" : "deactivated"}`,
          color: "green",
        });
      })
      .catch(onApiError);
  };

  const handleSendEmail = () => {
    setSendingEmail(true);
    sendEmailNow({
      subscriptionId: subscription._id,
    })
      .then((result) => {
        if (result.success) {
          notifications.show({
            title: "Success",
            message: `Email sent successfully! ${result.eventsSent} events included.`,
            color: "green",
          });
        } else {
          notifications.show({
            title: "Error",
            message: result.message,
            color: "red",
          });
        }
      })
      .catch(onApiError)
      .finally(() => setSendingEmail(false));
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this subscription?")) return;

    deleteSubscription({ id: subscription._id })
      .then(() => {
        notifications.show({
          title: "Success",
          message: "Subscription deleted",
          color: "green",
        });
        onBack();
      })
      .catch(onApiError);
  };

  return (
    <Container size="lg">
      <Group gap="md" mb="xl">
        <ActionIcon variant="subtle" onClick={onBack}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Box>
          <Title order={1}>Subscription Details</Title>
          <Text c="dimmed" mt="xs">
            Manage your subscription settings and view pending events
          </Text>
        </Box>
      </Group>

      <Stack gap="lg">
        {/* Main subscription info */}
        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Group justify="space-between" align="flex-start" mb="lg">
            <Box style={{ flex: 1 }}>
              <Group gap="sm" mb="md">
                <Box
                  w={12}
                  h={12}
                  bg={subscription.isActive ? "green.5" : "gray.4"}
                  style={{ borderRadius: "50%" }}
                />
                <Badge color={subscription.isActive ? "green" : "gray"}>
                  {subscription.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge color={isAllEventsSubscription ? "purple" : "orange"}>
                  {isAllEventsSubscription ? "All Events" : "Prompt-based"}
                </Badge>
              </Group>

              {editingPrompt && isPromptSubscription ? (
                <Stack gap="sm">
                  <Textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={3}
                    autosize
                    label="Subscription Prompt"
                  />
                  <Group gap="xs">
                    <Button
                      onClick={handleSavePrompt}
                      color="green"
                      size="sm"
                      leftSection={<IconCheck size={16} />}
                    >
                      Save
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      variant="default"
                      size="sm"
                      leftSection={<IconX size={16} />}
                    >
                      Cancel
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Box>
                  {isPromptSubscription ? (
                    <Box>
                      <Text fw={500} size="sm" mb="xs">
                        Subscription Prompt:
                      </Text>
                      <Text size="md" style={{ lineHeight: 1.6 }}>
                        "{(subscription as any).prompt}"
                      </Text>
                    </Box>
                  ) : (
                    <Box>
                      <Text fw={500} size="sm" mb="xs">
                        Subscription Type:
                      </Text>
                      <Text size="md" style={{ lineHeight: 1.6 }} c="purple.7">
                        Subscribed to all events
                      </Text>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            <Stack gap="xs" style={{ minWidth: "140px" }}>
              <Button
                onClick={handleToggleActive}
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

              {!editingPrompt && isPromptSubscription && (
                <Button
                  onClick={handleEditPrompt}
                  variant="light"
                  color="blue"
                  size="sm"
                  leftSection={<IconEdit size={16} />}
                >
                  Edit
                </Button>
              )}

              <Button
                onClick={handleDelete}
                variant="light"
                color="red"
                size="sm"
                leftSection={<IconTrash size={16} />}
              >
                Delete
              </Button>
            </Stack>
          </Group>

          <Divider my="md" />

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <Box>
              <Text fw={500} size="sm">
                Email frequency:
              </Text>
              <Text size="sm" c="dimmed">
                Every {subscription.emailFrequencyHours} hours
              </Text>
            </Box>
            <Box>
              <Text fw={500} size="sm">
                Last email sent:
              </Text>
              <Text size="sm" c="dimmed">
                {subscription.lastEmailSent
                  ? formatDate(subscription.lastEmailSent)
                  : "Never"}
              </Text>
            </Box>
            <Box>
              <Text fw={500} size="sm">
                Next email scheduled:
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
        </Card>

        {/* Queued events */}
        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <Group justify="space-between" align="center" mb="lg">
            <Box>
              <Title order={2}>Pending Events</Title>
              <Text c="dimmed" size="sm">
                {subscription.totalQueuedEvents} events queued for next email
              </Text>
            </Box>
            {subscription.totalQueuedEvents > 0 && (
              <Button
                onClick={handleSendEmail}
                loading={sendingEmail}
                color="green"
                leftSection={<IconMail size={16} />}
              >
                {sendingEmail ? "Sending..." : "Send Email Now"}
              </Button>
            )}
          </Group>

          {subscription.queuedEvents.length === 0 ? (
            <Box ta="center" py="xl">
              <Text size="3rem" style={{ marginBottom: "1rem" }}>
                📭
              </Text>
              <Text size="lg" fw={500} mb="xs">
                No pending events
              </Text>
              <Text c="dimmed">
                Events matching your subscription will appear here
              </Text>
            </Box>
          ) : (
            <Stack gap="md">
              {subscription.queuedEvents.map((queueItem: any) => (
                <Card key={queueItem._id} withBorder radius="md" p="md">
                  <Group justify="space-between" align="flex-start">
                    <Box style={{ flex: 1 }}>
                      <Group gap="xs" align="center" mb="xs">
                        <Text fw={500} size="sm">
                          {queueItem.event?.title || "Event not found"}
                        </Text>
                        <Badge size="sm" color="blue">
                          {(queueItem.matchScore * 100).toFixed(0)}% match
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mb="xs">
                        📅{" "}
                        {queueItem.event
                          ? formatDate(queueItem.event.eventDate)
                          : "Unknown date"}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Queued: {formatDate(queueItem.queuedAt)}
                      </Text>
                      {queueItem.event?.description && (
                        <EventDescription
                          description={queueItem.event.description}
                          maxLines={2}
                          size="xs"
                          c="dimmed"
                          mt="xs"
                        />
                      )}
                    </Box>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Card>
      </Stack>
    </Container>
  );
}
