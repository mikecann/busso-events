import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { formatDate } from "../utils/dateUtils";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  Badge,
  Loader,
  Center,
  Box,
} from "@mantine/core";
import { IconArrowLeft, IconSearch } from "@tabler/icons-react";

interface SourcesListPageProps {
  onBack: () => void;
  onNavigateToAddSource: () => void;
  onNavigateToSourceDetail: (sourceId: Id<"eventSources">) => void;
}

export function SourcesListPage({
  onBack,
  onNavigateToAddSource,
  onNavigateToSourceDetail,
}: SourcesListPageProps) {
  const sources = useQuery(api.eventSources.list);

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
            {sources.map((source: Doc<"eventSources">) => (
              <Card
                key={source._id}
                shadow="sm"
                padding="xl"
                radius="lg"
                withBorder
                style={{ cursor: "pointer" }}
                onClick={() => onNavigateToSourceDetail(source._id)}
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
                  </Box>

                  <Box style={{ minWidth: "120px" }}>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card click
                        onNavigateToSourceDetail(source._id);
                      }}
                      variant="light"
                      color="violet"
                      size="sm"
                      leftSection={<IconSearch size={16} />}
                    >
                      View Details
                    </Button>
                  </Box>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
