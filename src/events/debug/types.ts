import { Id } from "../../../convex/_generated/dataModel";

export interface EventDebugPageProps {
  eventId: string;
  onBack: () => void;
}

export interface DebugSectionProps {
  eventId: Id<"events">;
}
