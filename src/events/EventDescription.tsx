import { Box, BoxProps, MantineSize } from "@mantine/core";
import MarkdownPreview from "@uiw/react-markdown-preview";

interface EventDescriptionProps extends Omit<BoxProps, "children"> {
  description: string;
  maxLines?: number;
  size?: MantineSize | "xs" | "sm" | "md" | "lg" | "xl";
}

export function EventDescription({
  description,
  maxLines,
  size,
  ...boxProps
}: EventDescriptionProps) {
  if (!description) return null;

  const getSizeStyle = (size?: string) => {
    const sizeMap: Record<string, string> = {
      xs: "var(--mantine-font-size-xs)",
      sm: "var(--mantine-font-size-sm)",
      md: "var(--mantine-font-size-md)",
      lg: "var(--mantine-font-size-lg)",
      xl: "var(--mantine-font-size-xl)",
    };
    return size ? { fontSize: sizeMap[size] || size } : {};
  };

  return (
    <Box
      {...boxProps}
      style={{
        ...getSizeStyle(size),
        ...boxProps.style,
        ...(maxLines && {
          display: "-webkit-box",
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }),
      }}
    >
      <MarkdownPreview
        source={description}
        style={{
          backgroundColor: "transparent",
          color: "inherit",
          fontSize: "inherit",
          lineHeight: "inherit",
        }}
        wrapperElement={{
          "data-color-mode": "light",
        }}
      />
    </Box>
  );
}
