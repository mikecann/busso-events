import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { notifications } from "@mantine/notifications";
import { TestScrapeProgress } from "./TestScrapeProgress";
import { useAPIErrorHandler } from "../utils/hooks";
import { routes } from "../router";
import {
  Container,
  Title,
  Text,
  Button,
  Card,
  Stack,
  Group,
  TextInput,
  Alert,
  Box,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconSearch,
  IconAlertTriangle,
} from "@tabler/icons-react";

interface AddSourcePageProps {
  onBack: () => void;
}

export function AddSourcePage({ onBack }: AddSourcePageProps) {
  const createSource = useMutation(api.eventSources.eventSourcesAdmin.create);
  const startTestScrape = useMutation(
    api.eventSources.eventSourcesAdmin.startTestScrape,
  );

  const [currentTestScrapeId, setCurrentTestScrapeId] =
    useState<Id<"testScrapes"> | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    startingUrl: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const onApiError = useAPIErrorHandler();

  return (
    <Container size="md">
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={() => void onBack()}
          style={{ alignSelf: "flex-start" }}
        >
          Back to Sources
        </Button>
        <Box>
          <Title order={1} size="2.5rem">
            Add Event Source
          </Title>
          <Text c="dimmed" mt="xs">
            Configure a new source for automatic event discovery
          </Text>
        </Box>
        <Card shadow="sm" padding="xl" radius="lg" withBorder>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsLoading(true);

              createSource({
                name: formData.name,
                startingUrl: formData.startingUrl,
              })
                .then(() => {
                  notifications.show({
                    message: "Event source created successfully!",
                    color: "green",
                  });
                  routes.sources().push();
                })
                .catch(onApiError)
                .finally(() => setIsLoading(false));
            }}
          >
            <Stack gap="lg">
              <TextInput
                label="Source Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Tech Events SF, Startup Meetups"
                required
              />
              <Box>
                <TextInput
                  label="Starting URL"
                  type="url"
                  value={formData.startingUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, startingUrl: e.target.value })
                  }
                  placeholder="https://example.com/events"
                  required
                />
                <Text size="sm" c="dimmed" mt="xs">
                  The URL where the scraper should start looking for events
                </Text>
              </Box>

              <Alert
                icon={<IconAlertTriangle size={16} />}
                title="Important Note"
                color="yellow"
              >
                Make sure the URL you provide contains event listings that can
                be scraped. The system will attempt to automatically discover
                and extract event information.
              </Alert>
              <Group justify="space-between">
                <Button
                  type="button"
                  onClick={() => void onBack()}
                  variant="default"
                  size="lg"
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setIsLoading(true);
                    startTestScrape({ url: formData.startingUrl })
                      .then((testScrapeId) =>
                        setCurrentTestScrapeId(testScrapeId),
                      )
                      .catch(onApiError)
                      .finally(() => setIsLoading(false));
                  }}
                  disabled={!formData.startingUrl}
                  color="yellow"
                  size="lg"
                  style={{ flex: 1 }}
                  leftSection={<IconSearch size={16} />}
                >
                  {"Test Scrape"}
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="lg"
                  style={{ flex: 1 }}
                  loading={isLoading}
                >
                  {isLoading ? "Creating..." : "Create Source"}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
        <Card shadow="sm" padding="lg" radius="lg" withBorder>
          <TestScrapeProgress testScrapeId={currentTestScrapeId} />
        </Card>
      </Stack>
    </Container>
  );
}
