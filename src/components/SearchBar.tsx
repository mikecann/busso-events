import { TextInput, ActionIcon } from "@mantine/core";
import { IconSearch, IconX } from "@tabler/icons-react";

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function SearchBar({ searchTerm, onSearchChange }: SearchBarProps) {
  return (
    <TextInput
      placeholder="Search events by title or description..."
      value={searchTerm}
      onChange={(e) => onSearchChange(e.currentTarget.value)}
      leftSection={<IconSearch size={16} />}
      rightSection={
        searchTerm ? (
          <ActionIcon
            variant="subtle"
            onClick={() => onSearchChange("")}
            color="gray"
          >
            <IconX size={16} />
          </ActionIcon>
        ) : null
      }
      style={{ maxWidth: 400, margin: "0 auto" }}
      size="md"
    />
  );
}
