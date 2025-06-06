import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInForm } from "./SignInForm";
import { AuthenticatedApp } from "./components/AuthenticatedApp";
import { PublicApp } from "./components/PublicApp";
import { useState } from "react";
import {
  Container,
  Center,
  Card,
  Title,
  Text,
  Button,
  Loader,
  Stack,
} from "@mantine/core";

export default function App() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <Container size="xl">
      <AuthLoading>
        <Center style={{ minHeight: "100vh" }}>
          <Loader size="lg" />
        </Center>
      </AuthLoading>
      <Unauthenticated>
        {showLogin ? (
          <Center style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
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
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => setShowLogin(false)}
                >
                  ← Back to browse events
                </Button>
              </Stack>
            </Card>
          </Center>
        ) : (
          <PublicApp onNavigateToLogin={() => setShowLogin(true)} />
        )}
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
    </Container>
  );
}
