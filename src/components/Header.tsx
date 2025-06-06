import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";
import { Group, Text, Badge, Button, Container, Paper } from "@mantine/core";

interface HeaderProps {
  onNavigateHome: () => void;
  onNavigateSubscriptions: () => void;
  onNavigateAdmin?: () => void;
  currentPage: string;
}

export function Header({
  onNavigateHome,
  onNavigateSubscriptions,
  onNavigateAdmin,
  currentPage,
}: HeaderProps) {
  const user = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.users.isCurrentUserAdmin);

  return (
    <Paper
      shadow="xs"
      withBorder
      style={{ borderTop: "none", borderLeft: "none", borderRight: "none" }}
    >
      <Container size="xl" py="md">
        <Group justify="space-between">
          <Group gap="xl">
            <Button
              variant="subtle"
              size="lg"
              onClick={onNavigateHome}
              color={currentPage === "home" ? "blue" : "gray"}
              style={{ fontWeight: "bold", fontSize: "1.25rem" }}
            >
              EventFinder
            </Button>

            <Group gap="lg">
              <Button
                variant="subtle"
                onClick={onNavigateHome}
                color={currentPage === "home" ? "blue" : "gray"}
                style={{
                  borderBottom:
                    currentPage === "home"
                      ? "2px solid var(--mantine-color-blue-6)"
                      : "none",
                }}
              >
                Events
              </Button>

              <Button
                variant="subtle"
                onClick={onNavigateSubscriptions}
                color={
                  currentPage === "subscriptions" ||
                  currentPage === "create-subscription"
                    ? "blue"
                    : "gray"
                }
                style={{
                  borderBottom:
                    currentPage === "subscriptions" ||
                    currentPage === "create-subscription"
                      ? "2px solid var(--mantine-color-blue-6)"
                      : "none",
                }}
              >
                Subscriptions
              </Button>

              {isAdmin && onNavigateAdmin && (
                <Button
                  variant="subtle"
                  onClick={onNavigateAdmin}
                  color={
                    [
                      "admin",
                      "event-debug",
                      "add-event",
                      "sources",
                      "add-source",
                    ].includes(currentPage)
                      ? "blue"
                      : "gray"
                  }
                  style={{
                    borderBottom: [
                      "admin",
                      "event-debug",
                      "add-event",
                      "sources",
                      "add-source",
                    ].includes(currentPage)
                      ? "2px solid var(--mantine-color-blue-6)"
                      : "none",
                  }}
                >
                  Admin
                </Button>
              )}
            </Group>
          </Group>

          <Group gap="md">
            {user && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  Welcome, {user.name || user.email || "User"}
                </Text>
                {isAdmin && (
                  <Badge color="blue" size="sm">
                    Admin
                  </Badge>
                )}
              </Group>
            )}
            <SignOutButton />
          </Group>
        </Group>
      </Container>
    </Paper>
  );
}
