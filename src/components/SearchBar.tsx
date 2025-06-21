import { TextInput, ActionIcon, Tooltip } from "@mantine/core";
import { IconSearch, IconX, IconBrain } from "@tabler/icons-react";

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function SearchBar({ searchTerm, onSearchChange }: SearchBarProps) {
  const isSemanticSearch = searchTerm.trim().length > 3;

  return (
    <TextInput
      placeholder="Search events by title, description, or meaning..."
      value={searchTerm}
      onChange={(e) => onSearchChange(e.currentTarget.value)}
      leftSection={
        <Tooltip
          label={
            isSemanticSearch
              ? "Using AI-powered semantic search + text search"
              : "Using text search only"
          }
          position="bottom"
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <IconSearch size={16} />
            {isSemanticSearch && (
              <IconBrain
                size={12}
                style={{
                  marginLeft: 2,
                  color: "var(--mantine-color-blue-6)",
                }}
              />
            )}
          </div>
        </Tooltip>
      }
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
