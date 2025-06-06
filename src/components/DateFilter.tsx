interface DateFilterProps {
  value: "all" | "week" | "month" | "3months";
  onChange: (filter: "all" | "week" | "month" | "3months") => void;
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as "all" | "week" | "month" | "3months")}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
    >
      <option value="all">All Events</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
      <option value="3months">Next 3 Months</option>
    </select>
  );
}
