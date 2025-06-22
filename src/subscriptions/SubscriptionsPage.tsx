import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Loader,
  Center,
  Box,
} from "@mantine/core";
import { SubscriptionCard } from "./SubscriptionCard";

interface SubscriptionsPageProps {
  onCreateNew: () => void;
}

export function SubscriptionsPage({ onCreateNew }: SubscriptionsPageProps) {
  const subscriptions = useQuery(api.subscriptions.subscriptions.list);

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
            <SubscriptionCard
              key={subscription._id}
              subscription={subscription}
            />
          ))}
        </Stack>
      )}
    </Container>
  );
}
