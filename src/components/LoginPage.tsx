import { SignInForm } from "../SignInForm";
import { navigation } from "../router";
import {
  Container,
  Group,
  Button,
  Paper,
  Stack,
  Title,
  Text,
  Center,
  Card,
} from "@mantine/core";

export function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      <Paper
        shadow="xs"
        withBorder
        style={{ borderTop: "none", borderLeft: "none", borderRight: "none" }}
      >
        <Container size="xl" py="md">
          <Group justify="space-between">
            <Button
              variant="subtle"
              size="lg"
              {...navigation.home().link}
              color="gray"
              style={{ fontWeight: "bold", fontSize: "1.25rem" }}
            >
              EventFinder
            </Button>
            <Button {...navigation.login().link} size="md">
              Sign In
            </Button>
          </Group>
        </Container>
      </Paper>
      <Container size="xl" py="xl">
        <Center style={{ minHeight: "50vh" }}>
          <Card
            shadow="sm"
            padding="xl"
            radius="md"
            withBorder
            style={{ width: "100%", maxWidth: "400px" }}
          >
            <Stack align="center" gap="md">
              <div style={{ textAlign: "center" }}>
                <Title order={2} mb="xs">
                  Welcome to EventFinder
                </Title>
                <Text c="dimmed">
                  Sign in to manage your event subscriptions
                </Text>
              </div>
              <SignInForm />
              <Button variant="subtle" size="sm" {...navigation.home().link}>
                ← Back to browse events
              </Button>
            </Stack>
          </Card>
        </Center>
      </Container>
    </div>
  );
}
