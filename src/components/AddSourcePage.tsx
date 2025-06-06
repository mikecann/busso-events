import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
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
  const createSource = useMutation(api.eventSources.create);
  const testScrape = useAction(api.eventSources.testScrape);

  const [formData, setFormData] = useState({
    name: "",
    startingUrl: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createSource({
        name: formData.name,
        startingUrl: formData.startingUrl,
      });
      toast.success("Event source created successfully!");
      onBack();
    } catch (error) {
      toast.error("Failed to create event source");
      console.error("Error creating source:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestScrape = async () => {
    if (!formData.startingUrl) {
      toast.error("Please enter a URL first");
      return;
    }

    setIsTesting(true);
    try {
      // First create the source temporarily to test it
      const sourceId = await createSource({
        name: formData.name || "Test Source",
        startingUrl: formData.startingUrl,
      });

      const result = await testScrape({
        sourceId,
      });

      if (result.success) {
        toast.success(`Test successful! ${result.message}`);
      } else {
        toast.error(`Test failed: ${result.message}`);
      }
    } catch (error) {
      toast.error("Test scrape failed");
      console.error("Error testing scrape:", error);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Container size="md">
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={onBack}
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
          <form onSubmit={handleSubmit}>
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
                  onClick={onBack}
                  variant="default"
                  size="lg"
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handleTestScrape}
                  disabled={isTesting || !formData.startingUrl}
                  color="yellow"
                  size="lg"
                  style={{ flex: 1 }}
                  leftSection={<IconSearch size={16} />}
                  loading={isTesting}
                >
                  {isTesting ? "Testing..." : "Test Scrape"}
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="lg"
                  style={{ flex: 1 }}
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Source"}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
}
