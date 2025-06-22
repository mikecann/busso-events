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
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { SubscriptionPreview } from "./components/SubscriptionPreview";

interface CreateSubscriptionPageProps {
  onBack: () => void;
}

export function CreateSubscriptionPage({
  onBack,
}: CreateSubscriptionPageProps) {
  const createSubscription = useMutation(
    api.subscriptions.subscriptions.create,
  );

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
              if (!prompt.trim()) {
                toast.error("Please enter a prompt");
                return;
              }

              setIsLoading(true);
              createSubscription({
                prompt: prompt.trim(),
                isActive: true,
              })
                .then(() => {
                  toast.success("Subscription created successfully!");
                  onBack();
                })
                .catch(onApiError)
                .finally(() => setIsLoading(false));
            }}
          >
            <Stack gap="lg">
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
                  Describe the types of events you'd like to be notified about.
                  Be as specific or general as you'd like.
                </Text>
              </Box>

              <SubscriptionPreview prompt={prompt} onError={onApiError} />

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
                  disabled={isLoading || !prompt.trim()}
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
