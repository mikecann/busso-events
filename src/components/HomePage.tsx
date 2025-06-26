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
  Box,
  Image,
} from "@mantine/core";
import { SearchBar } from "./SearchBar";
import { DateFilter } from "./DateFilter";

export function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.loggedInUser);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "week" | "month" | "3months"
  >("all");

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

        {/* Hero Section with Background */}
        <Box
          style={{
            backgroundColor: "var(--mantine-primary-color-6)",
            borderBottom: "1px solid var(--mantine-primary-color-4)",
            paddingTop: "6rem",
          }}
        >
          <Container size="xl" py={isAuthenticated ? "sm" : "xl"}>
            <Stack gap="xl">
              {isAuthenticated ? null : (
                <Center>
                  <Stack
                    gap="sm"
                    align="center"
                    style={{
                      textAlign: "center",
                    }}
                  >
                    <Group gap="md" align="center" justify="center">
                      <Title order={1} size="3rem" fw={700} c="white">
                        Busso Events
                      </Title>
                    </Group>
                    <Text size="xl" c="gray.3" style={{ marginBottom: "1rem" }}>
                      All the events for Busselton and the south west,
                      aggregated in one place
                    </Text>
                  </Stack>
                </Center>
              )}

              {/* Search and Filter Controls */}
              <Center>
                <Group align="flex-start" gap="md" style={{ flexWrap: "wrap" }}>
                  <div
                    style={{ flex: 1, minWidth: "300px", maxWidth: "400px" }}
                  >
                    <SearchBar
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                    />
                  </div>
                  <DateFilter value={dateFilter} onChange={setDateFilter} />
                </Group>
              </Center>
            </Stack>
          </Container>
        </Box>

        {/* Main Content */}
        <Container size="xl" py="xl">
          <EventGallery
            onEventClick={(eventId) => routes.eventDetail({ eventId }).push()}
            searchTerm={searchTerm}
            dateFilter={dateFilter}
          />
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
            <Group gap="sm" align="center">
              <Image
                src="/logo-128.png"
                alt="Busso Events Logo"
                w={24}
                h={24}
              />
              <Text size="1.25rem" fw={500}>
                Busso Events
              </Text>
            </Group>
            <Button {...routes.login().link} size="md">
              Sign In
            </Button>
          </Group>
        </Container>
      </div>

      {/* Hero Section with Background */}
      <Box
        style={{
          backgroundColor: "var(--mantine-primary-color-6)",
          borderBottom: "1px solid var(--mantine-primary-color-4)",
          paddingTop: "0", // No top padding since we want content to start from top
        }}
      >
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
                <Image
                  src="/logo-128.png"
                  alt="Busso Events Logo"
                  w={128}
                  h={128}
                />
                <Group gap="md" align="center" justify="center">
                  <Title order={1} size="3rem" fw={700} c="white">
                    Busso Events
                  </Title>
                </Group>
                <Text size="xl" c="gray.3" style={{ marginBottom: "1rem" }}>
                  All the events for Busselton and the south west, aggregated in
                  one place
                </Text>
                <Button {...routes.login().link} color="dark" size="md">
                  Sign In To Subscribe to Events
                </Button>
              </Stack>
            </Center>
          </Stack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container size="xl" py="xl">
        <EventGallery
          onEventClick={(eventId) => routes.eventDetail({ eventId }).push()}
          searchTerm=""
          dateFilter="all"
        />
      </Container>
    </div>
  );
}
