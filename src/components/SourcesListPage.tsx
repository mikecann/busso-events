import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { useAPIErrorHandler } from "../utils/hooks";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Badge,
  TextInput,
  Loader,
  Center,
  Box,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconPlayerPause,
  IconPlayerPlay,
  IconWorld,
} from "@tabler/icons-react";

interface SourcesListPageProps {
  onBack: () => void;
  onNavigateToAddSource: () => void;
}

export function SourcesListPage({
  onBack,
  onNavigateToAddSource,
}: SourcesListPageProps) {
  const sources = useQuery(api.eventSources.list);
  const updateSource = useMutation(api.eventSources.update);
  const deleteSource = useMutation(api.eventSources.remove);

  const [editingId, setEditingId] = useState<Id<"eventSources"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const onApiError = useAPIErrorHandler();

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleEdit = (source: {
    _id: Id<"eventSources">;
    name: string;
    startingUrl: string;
  }) => {
    setEditingId(source._id);
    setEditName(source.name);
    setEditUrl(source.startingUrl);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditUrl("");
  };

  if (sources === undefined) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={onBack}
          style={{ alignSelf: "flex-start" }}
        >
          Back to Admin
        </Button>

        <Group justify="space-between">
          <Box>
            <Title order={1} size="2.5rem">
              Event Sources
            </Title>
            <Text c="dimmed" mt="xs">
              Manage sources for event scraping
            </Text>
          </Box>
          <Button onClick={onNavigateToAddSource} size="lg">
            + Add Source
          </Button>
        </Group>

        {sources.length === 0 ? (
          <Card
            shadow="sm"
            padding="xl"
            radius="lg"
            style={{ textAlign: "center" }}
          >
            <Text size="4rem" style={{ marginBottom: "1rem" }}>
              🌐
            </Text>
            <Title order={3} mb="xs">
              No sources configured
            </Title>
            <Text c="dimmed" mb="lg">
              Add your first event source to start scraping events
            </Text>
            <Button onClick={onNavigateToAddSource} size="lg">
              Add Your First Source
            </Button>
          </Card>
        ) : (
          <Stack gap="lg">
            {sources.map((source) => (
              <Card
                key={source._id}
                shadow="sm"
                padding="xl"
                radius="lg"
                withBorder
              >
                <Group align="flex-start" justify="space-between">
                  <Box style={{ flex: 1 }}>
                    <Group gap="sm" mb="sm">
                      <Box
                        w={12}
                        h={12}
                        bg={source.isActive ? "green.5" : "gray.4"}
                        style={{ borderRadius: "50%" }}
                      />
                      <Badge
                        color={source.isActive ? "green" : "gray"}
                        size="sm"
                      >
                        {source.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </Group>

                    {editingId === source._id ? (
                      <Stack gap="sm">
                        <TextInput
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Source name"
                        />
                        <TextInput
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          placeholder="Starting URL"
                          type="url"
                        />
                        <Group gap="xs">
                          <Button
                            onClick={() => {
                              updateSource({
                                id: source._id,
                                name: editName,
                                startingUrl: editUrl,
                              })
                                .then(() => {
                                  setEditingId(null);
                                  toast.success("Source updated");
                                })
                                .catch(onApiError);
                            }}
                            color="green"
                            size="sm"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            variant="default"
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </Group>
                      </Stack>
                    ) : (
                      <Stack gap="sm">
                        <Title order={3} size="lg">
                          {source.name}
                        </Title>
                        <Text
                          size="sm"
                          c="dimmed"
                          style={{ wordBreak: "break-all" }}
                        >
                          {source.startingUrl}
                        </Text>
                        <Group gap="xs">
                          <Text fw={500} size="sm">
                            Last scraped:
                          </Text>
                          <Text size="sm" c="dimmed">
                            {formatDate(source.dateLastScrape)}
                          </Text>
                        </Group>
                      </Stack>
                    )}
                  </Box>

                  <Stack gap="xs" style={{ minWidth: "120px" }}>
                    <Button
                      onClick={() =>
                        updateSource({
                          id: source._id,
                          isActive: !source.isActive,
                        })
                          .then(() => {
                            toast.success(
                              `Source ${!source.isActive ? "activated" : "deactivated"}`,
                            );
                          })
                          .catch(onApiError)
                      }
                      variant="light"
                      color={source.isActive ? "yellow" : "green"}
                      size="sm"
                      leftSection={
                        source.isActive ? (
                          <IconPlayerPause size={16} />
                        ) : (
                          <IconPlayerPlay size={16} />
                        )
                      }
                    >
                      {source.isActive ? "Pause" : "Activate"}
                    </Button>

                    {editingId !== source._id && (
                      <Button
                        onClick={() => handleEdit(source)}
                        variant="light"
                        color="blue"
                        size="sm"
                        leftSection={<IconEdit size={16} />}
                      >
                        Edit
                      </Button>
                    )}

                    <Button
                      onClick={() => {
                        if (
                          !confirm(
                            "Are you sure you want to delete this source?",
                          )
                        )
                          return;

                        deleteSource({ id: source._id })
                          .then(() => toast.success("Source deleted"))
                          .catch(onApiError);
                      }}
                      variant="light"
                      color="red"
                      size="sm"
                      leftSection={<IconTrash size={16} />}
                    >
                      Delete
                    </Button>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
