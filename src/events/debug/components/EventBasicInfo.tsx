import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { useAPIErrorHandler } from "../../../utils/hooks";
import { formatDateDetailed as formatDate } from "../../../utils/dateUtils";
import {
  Card,
  Stack,
  Group,
  Badge,
  TextInput,
  Textarea,
  Box,
  Text,
  Button,
  SimpleGrid,
  Divider,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { DebugSectionProps } from "../types";

export function EventBasicInfo({ eventId }: DebugSectionProps) {
  const event = useQuery(api.events.events.getById, { id: eventId });
  const updateEvent = useMutation(api.events.eventsAdmin.updateEvent);
  const deleteEvent = useMutation(api.events.eventsAdmin.deleteEvent);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const onApiError = useAPIErrorHandler();

  if (!event) return null;

  const handleEdit = (field: string, currentValue: unknown) => {
    setEditingField(field);
    setEditValues({ [field]: currentValue });
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValues({});
  };

  const renderEditableField = (
    field: string,
    label: string,
    value: string | number | undefined,
    type: "text" | "textarea" | "datetime" = "text",
  ) => {
    const isEditing = editingField === field;

    return (
      <Box
        py="md"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
      >
        <Text fw={500} size="sm" mb="xs" c="gray.7">
          {label}
        </Text>
        {isEditing ? (
          <Stack gap="sm">
            {type === "textarea" ? (
              <Textarea
                value={String(editValues[field] || "")}
                onChange={(e) =>
                  setEditValues({ ...editValues, [field]: e.target.value })
                }
                rows={4}
                autosize
              />
            ) : type === "datetime" ? (
              <TextInput
                type="datetime-local"
                value={new Date(
                  Number(editValues[field]) ||
                    (typeof value === "number" ? value : Date.now()),
                )
                  .toISOString()
                  .slice(0, 16)}
                onChange={(e) =>
                  setEditValues({
                    ...editValues,
                    [field]: new Date(e.target.value).getTime(),
                  })
                }
              />
            ) : (
              <TextInput
                value={String(editValues[field] || "")}
                onChange={(e) =>
                  setEditValues({ ...editValues, [field]: e.target.value })
                }
              />
            )}
            <Group gap="xs">
              <Button
                onClick={() => {
                  setIsUpdating(true);
                  updateEvent({
                    id: eventId,
                    [field]: editValues[field],
                  })
                    .then(() => {
                      setEditingField(null);
                      toast.success(`${field} updated successfully`);
                    })
                    .catch(onApiError)
                    .finally(() => setIsUpdating(false));
                }}
                disabled={isUpdating}
                color="green"
                size="sm"
                loading={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save"}
              </Button>
              <Button onClick={handleCancel} variant="default" size="sm">
                Cancel
              </Button>
            </Group>
          </Stack>
        ) : (
          <Group justify="space-between" align="flex-start">
            <Box style={{ flex: 1 }}>
              {type === "datetime" ? (
                <Text>
                  {typeof value === "number" ? formatDate(value) : "Not set"}
                </Text>
              ) : (
                <Text style={{ whiteSpace: "pre-wrap" }}>
                  {value || "Not set"}
                </Text>
              )}
            </Box>
            <Button
              onClick={() => handleEdit(field, value)}
              variant="light"
              size="xs"
              disabled={isUpdating}
            >
              Edit
            </Button>
          </Group>
        )}
      </Box>
    );
  };

  return (
    <Card shadow="sm" padding="xl" radius="lg" withBorder>
      <Group justify="space-between" align="center" mb="lg">
        <Text fw={700} size="xl">
          Event Details
        </Text>
        <Button
          onClick={() => {
            if (
              !confirm(
                "Are you sure you want to delete this event? This action cannot be undone.",
              )
            )
              return;

            setIsDeleting(true);
            deleteEvent({ id: eventId })
              .then(() => {
                toast.success("Event deleted successfully");
                window.history.back();
              })
              .catch(onApiError)
              .finally(() => setIsDeleting(false));
          }}
          color="red"
          variant="light"
          leftSection={<IconTrash size={16} />}
          loading={isDeleting}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete Event"}
        </Button>
      </Group>

      <Stack gap={0}>
        {renderEditableField("title", "Title", event.title)}
        {renderEditableField(
          "description",
          "Description",
          event.description,
          "textarea",
        )}
        {renderEditableField("url", "URL", event.url)}
        {renderEditableField("imageUrl", "Image URL", event.imageUrl)}
        {renderEditableField(
          "eventDate",
          "Event Date",
          event.eventDate,
          "datetime",
        )}
      </Stack>

      <Divider my="lg" />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Event ID:
          </Text>
          <Text ff="monospace" size="sm">
            {event._id}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Creation Time:
          </Text>
          <Text size="sm">{formatDate(event._creationTime)}</Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Last Scraped:
          </Text>
          <Text size="sm">
            {event.lastScraped ? formatDate(event.lastScraped) : "Never"}
          </Text>
        </Box>
        <Box>
          <Text fw={500} size="sm" c="gray.7">
            Scheduled Embedding:
          </Text>
          <Text size="sm">
            {event.descriptionEmbedding ? "Generated" : "Not generated"}
          </Text>
        </Box>
        {event.sourceId && (
          <Box>
            <Text fw={500} size="sm" c="gray.7">
              Source ID:
            </Text>
            <Text ff="monospace" size="sm">
              {event.sourceId}
            </Text>
          </Box>
        )}
      </SimpleGrid>
    </Card>
  );
}
