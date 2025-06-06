import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";
import { navigation } from "../router";
import { Group, Text, Badge, Button, Container, Paper } from "@mantine/core";

interface HeaderProps {
  currentRoute: string | false;
}

export function Header({ currentRoute }: HeaderProps) {
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
              {...navigation.dashboard().link}
              color={currentRoute === "dashboard" ? "blue" : "gray"}
              style={{ fontWeight: "bold", fontSize: "1.25rem" }}
            >
              EventFinder
            </Button>

            <Group gap="lg">
              <Button
                variant="subtle"
                {...navigation.dashboard().link}
                color={currentRoute === "dashboard" ? "blue" : "gray"}
                style={{
                  borderBottom:
                    currentRoute === "dashboard"
                      ? "2px solid var(--mantine-color-blue-6)"
                      : "none",
                }}
              >
                Events
              </Button>

              <Button
                variant="subtle"
                {...navigation.subscriptions().link}
                color={
                  currentRoute === "subscriptions" ||
                  currentRoute === "createSubscription"
                    ? "blue"
                    : "gray"
                }
                style={{
                  borderBottom:
                    currentRoute === "subscriptions" ||
                    currentRoute === "createSubscription"
                      ? "2px solid var(--mantine-color-blue-6)"
                      : "none",
                }}
              >
                Subscriptions
              </Button>

              {isAdmin && (
                <Button
                  variant="subtle"
                  {...navigation.admin().link}
                  color={
                    ["admin", "eventDebug", "sources", "addSource"].includes(
                      currentRoute as string,
                    )
                      ? "blue"
                      : "gray"
                  }
                  style={{
                    borderBottom: [
                      "admin",
                      "eventDebug",
                      "sources",
                      "addSource",
                    ].includes(currentRoute as string)
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
