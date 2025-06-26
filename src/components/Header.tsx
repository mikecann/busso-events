import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { routes } from "../router";
import {
  Group,
  Text,
  Badge,
  Button,
  Container,
  Paper,
  Avatar,
  Menu,
  rem,
} from "@mantine/core";
import { IconUser, IconLogout, IconChevronDown } from "@tabler/icons-react";

interface HeaderProps {
  currentRoute: string | false;
}

export function Header({ currentRoute }: HeaderProps) {
  const user = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.users.isCurrentUserAdmin);
  const { signOut } = useAuthActions();

  // Generate initials from user name or email
  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

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
              {...routes.dashboard().link}
              color={currentRoute === "dashboard" ? "blue" : "gray"}
              style={{ fontWeight: "bold", fontSize: "1.25rem" }}
            >
              Busso Events
            </Button>

            <Group gap="lg">
              <Button
                variant="subtle"
                {...routes.dashboard().link}
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
                {...routes.subscriptions().link}
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
                  {...routes.admin().link}
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

          {user && (
            <Menu shadow="md" width={250} position="bottom-end">
              <Menu.Target>
                <Group
                  gap="xs"
                  style={{
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: "8px",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--mantine-color-gray-0)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Avatar size="md" radius="xl" color="blue">
                    {getUserInitials()}
                  </Avatar>
                  <IconChevronDown
                    size={16}
                    color="var(--mantine-color-gray-6)"
                  />
                </Group>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={
                    <IconUser style={{ width: rem(14), height: rem(14) }} />
                  }
                  disabled
                >
                  <div>
                    <Text size="sm" fw={500}>
                      {user.name || "User"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {user.email}
                    </Text>
                    {isAdmin && (
                      <Badge color="blue" size="xs" mt="2px">
                        Admin
                      </Badge>
                    )}
                  </div>
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  leftSection={
                    <IconLogout style={{ width: rem(14), height: rem(14) }} />
                  }
                  onClick={() => void signOut()}
                  color="red"
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Container>
    </Paper>
  );
}
