import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
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
  Textarea,
  Box,
  SegmentedControl,
  Alert,
} from "@mantine/core";
import { IconArrowLeft, IconInfoCircle } from "@tabler/icons-react";
import { SubscriptionPreview } from "./components/SubscriptionPreview";

interface CreateSubscriptionPageProps {
  onBack: () => void;
}

export function CreateSubscriptionPage({
  onBack,
}: CreateSubscriptionPageProps) {
  const createPromptSubscription = useMutation(
    api.subscriptions.subscriptions.createPrompt,
  );
  const createAllEventsSubscription = useMutation(
    api.subscriptions.subscriptions.createAllEvents,
  );

  const [subscriptionType, setSubscriptionType] = useState<
    "prompt" | "all_events"
  >("prompt");
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onApiError = useAPIErrorHandler();

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={onBack}
          style={{ alignSelf: "flex-start" }}
        >
          Back to Subscriptions
        </Button>

        <Box>
          <Title order={1} size="2.5rem">
            Create Event Subscription
          </Title>
          <Text c="dimmed" mt="xs">
            Get notified about events that match your interests
          </Text>
        </Box>

        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (subscriptionType === "prompt" && !prompt.trim()) {
                toast.error("Please enter a prompt for your subscription");
                return;
              }

              setIsLoading(true);

              if (subscriptionType === "prompt") {
                createPromptSubscription({
                  prompt: prompt.trim(),
                  isActive: true,
                })
                  .then(() => {
                    toast.success("Subscription created successfully!");
                    onBack();
                  })
                  .catch(onApiError)
                  .finally(() => setIsLoading(false));
              } else {
                createAllEventsSubscription({
                  isActive: true,
                })
                  .then(() => {
                    toast.success("Subscription created successfully!");
                    onBack();
                  })
                  .catch(onApiError)
                  .finally(() => setIsLoading(false));
              }
            }}
          >
            <Stack gap="lg">
              <Box>
                <Text fw={500} size="sm" mb="xs">
                  Subscription Type
                </Text>
                <SegmentedControl
                  value={subscriptionType}
                  onChange={(value) =>
                    setSubscriptionType(value as "prompt" | "all_events")
                  }
                  data={[
                    { label: "Specific Interests", value: "prompt" },
                    { label: "All Events", value: "all_events" },
                  ]}
                  fullWidth
                />
                <Text size="sm" c="dimmed" mt="xs">
                  Choose whether to get notified about specific types of events
                  or all events
                </Text>
              </Box>

              {subscriptionType === "all_events" && (
                <Alert
                  icon={<IconInfoCircle size={16} />}
                  color="blue"
                  variant="light"
                >
                  You'll receive notifications for all future events. This can
                  result in many emails.
                </Alert>
              )}

              {subscriptionType === "prompt" && (
                <Box>
                  <Text fw={500} size="sm" mb="xs">
                    What kind of events are you interested in?
                  </Text>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., AI and machine learning conferences, startup networking events, tech talks about web development..."
                    rows={4}
                    required
                    autosize
                  />
                  <Text size="sm" c="dimmed" mt="xs">
                    Describe the types of events you'd like to be notified
                    about. Be as specific or general as you'd like.
                  </Text>
                </Box>
              )}

              {subscriptionType === "prompt" && (
                <SubscriptionPreview prompt={prompt} onError={onApiError} />
              )}

              <Group justify="space-between" pt="md">
                <Button
                  type="button"
                  onClick={onBack}
                  variant="default"
                  size="lg"
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={
                    isLoading ||
                    (subscriptionType === "prompt" && !prompt.trim())
                  }
                  size="lg"
                  style={{ flex: 1 }}
                  loading={isLoading}
                >
                  {isLoading ? "Creating..." : "Create Subscription"}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
}
