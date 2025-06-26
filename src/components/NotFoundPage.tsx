import { routes } from "../router";
import { Container, Stack, Title, Text, Center, Button } from "@mantine/core";

export function NotFoundPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      <Container size="xl" py="xl">
        <Center style={{ minHeight: "50vh" }}>
          <Stack align="center" gap="md">
            <Title order={3}>Page not found</Title>
            <Text c="dimmed">The page you're looking for doesn't exist.</Text>
            <Button {...routes.home().link}>Go to Home</Button>
          </Stack>
        </Center>
      </Container>
    </div>
  );
}
