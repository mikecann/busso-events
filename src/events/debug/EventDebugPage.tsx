import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Container,
  Button,
  Stack,
  Center,
  Loader,
  Title,
  Text,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
interface EventDebugPageProps {
  eventId: string;
  onBack: () => void;
}
import { EventBasicInfo } from "./components/EventBasicInfo";
import { EventScraping } from "./components/EventScraping";
import { EmbeddingGeneration } from "./components/EmbeddingGeneration";
import { SubscriptionMatching } from "./components/SubscriptionMatching";
import { SearchTest } from "./components/SearchTest";
import { ScrapedData } from "./components/ScrapedData";
import { EventPreview } from "./components/EventPreview";

export function EventDebugPage({ eventId, onBack }: EventDebugPageProps) {
  // Cast the string eventId to proper Id type for Convex queries
  const typedEventId = eventId as Id<"events">;
  const event = useQuery(api.events.events.getById, { id: typedEventId });

  if (event === undefined) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  if (event === null) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Title order={3}>Event not found</Title>
          <Button
            variant="subtle"
            onClick={onBack}
            leftSection={<IconArrowLeft size={16} />}
          >
            Back
          </Button>
        </Stack>
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
          Back
        </Button>

        <EventBasicInfo eventId={typedEventId} />
        <EventScraping eventId={typedEventId} />
        <EmbeddingGeneration eventId={typedEventId} />
        <SubscriptionMatching eventId={typedEventId} />
        <SearchTest eventId={typedEventId} />
        <ScrapedData eventId={typedEventId} />
        <EventPreview eventId={typedEventId} />
      </Stack>
    </Container>
  );
}
