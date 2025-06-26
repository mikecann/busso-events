import { EventGallery } from "./EventGallery";
import { Header } from "./Header";
import { routes } from "../router";
import { useState, useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Container,
  Group,
  Button,
  Paper,
  Stack,
  Title,
  Text,
  Center,
} from "@mantine/core";

export function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.loggedInUser);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Show the header if user is authenticated
  if (isAuthenticated && user) {
    return (
      <div>
        <Header currentRoute="home" />
        <Container size="xl" py="xl" style={{ paddingTop: "6rem" }}>
          <Stack gap="xl">
            <Center>
              <Stack
                gap="sm"
                align="center"
                style={{
                  textAlign: "center",
                }}
              >
                <Title order={1} size="3rem" fw={700}>
                  Busso Events
                </Title>
                <Text size="xl" c="dimmed" style={{ marginBottom: "1rem" }}>
                  All the events for Busselton and the south west, aggregated in
                  one place
                </Text>
              </Stack>
            </Center>
            <EventGallery
              onEventClick={(eventId) => routes.eventDetail({ eventId }).push()}
            />
          </Stack>
        </Container>
      </div>
    );
  }

  // Show the public version with floating header if not authenticated
  return (
    <div style={{ minHeight: "100vh" }}>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          opacity: isScrolled ? 1 : 0,
          pointerEvents: isScrolled ? "auto" : "none",
          backgroundColor: isScrolled ? "white" : "transparent",
          zIndex: 1000,
          borderBottom: isScrolled ? "1px solid #e9ecef" : "none",
          transition: "all 0.3s ease",
        }}
      >
        <Container size="xl" py="md">
          <Group justify="space-between">
            <Text size="1.25rem" fw={500}>
              Busso Events
            </Text>
            <Button {...routes.login().link} size="md">
              Sign In
            </Button>
          </Group>
        </Container>
      </div>
      <Container size="xl" py="xl">
        <Stack gap="xl">
          <Center>
            <Stack
              gap="sm"
              align="center"
              style={{
                textAlign: "center",
              }}
            >
              <Title order={1} size="3rem" fw={700}>
                Busso Events
              </Title>
              <Text size="xl" c="dimmed" style={{ marginBottom: "1rem" }}>
                All the events for Busselton and the south west, aggregated in
                one place
              </Text>
              <Button {...routes.login().link} size="md">
                Sign In To Subscribe to Events
              </Button>
            </Stack>
          </Center>
          <EventGallery
            onEventClick={(eventId) => routes.eventDetail({ eventId }).push()}
          />
        </Stack>
      </Container>
    </div>
  );
}
