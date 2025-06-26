import { SignInForm } from "../SignInForm";
import { routes } from "../router";
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
      <Container
        size="xl"
        style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}
      >
        <Center style={{ width: "100%" }}>
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
                  Welcome to Busso Events
                </Title>
                <Text c="dimmed">
                  Sign in to manage your event subscriptions
                </Text>
              </div>
              <SignInForm />
              <Button variant="subtle" size="sm" {...routes.home().link}>
                ← Back to browse events
              </Button>
            </Stack>
          </Card>
        </Center>
      </Container>
    </div>
  );
}
