import { Select } from "@mantine/core";

interface DateFilterProps {
  value: "all" | "week" | "month" | "3months";
  onChange: (filter: "all" | "week" | "month" | "3months") => void;
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  return (
    <Select
      value={value}
      onChange={(newValue) =>
        onChange(newValue as "all" | "week" | "month" | "3months")
      }
      data={[
        { value: "all", label: "All Events" },
        { value: "week", label: "This Week" },
        { value: "month", label: "This Month" },
        { value: "3months", label: "Next 3 Months" },
      ]}
      style={{ minWidth: "150px" }}
    />
  );
}
