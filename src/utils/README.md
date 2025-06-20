# Utility Functions and Hooks

## Date Utilities

The `dateUtils.ts` file contains comprehensive utilities for formatting timestamps and dates across the application:

### Standard Date Formatting

#### formatDate(timestamp)
Formats a timestamp into a standard localized date string with optional "Never" fallback.
- Returns: "Dec 15, 2024, 10:30 AM" or "Never" for undefined values

#### formatDateShort(timestamp)
Formats a timestamp into a short date string without time.
- Returns: "Dec 15, 2024"

#### formatDateDetailed(timestamp)
Formats a timestamp into a detailed date string for debug pages.
- Returns: "Saturday, December 15, 2024, 10:30 AM PST"

#### formatEventDate(timestamp)
Formats a timestamp into a detailed event date string with timezone info.
- Returns: "Saturday, December 15, 2024, 10:30 AM PST"

#### formatEventDateFriendly(timestamp)
Formats a timestamp into a friendly event date string for cards and lists.
- Returns: "Mon, Dec 15, 2024"

### Time Formatting

#### formatTime(timestamp)
Formats just the time portion of a timestamp.
- Returns: "10:30 AM"

#### formatDateForCard(timestamp)
Formats a timestamp for event cards, returning structured date components.
- Returns: `{ month: "Dec", day: 15, weekday: "Mon" }`

### Relative Time Formatting

#### formatRelativeTime(timestamp)
Formats a timestamp as relative time from now (past times only).
- Returns: "2h ago", "3d ago", "Just now", or "Never" for undefined

#### formatRelativeTimeBidirectional(timestamp)
Formats a timestamp as relative time, handling both past and future times.
- Returns: "2h ago", "in 3d", "in 45m"

#### formatSchedulingTime(timestamp)
Formats a timestamp for scheduling context, showing "Ready to run" for past times.
- Returns: "Ready to run", "in 2h 30m"

### Utility Functions

#### isUpcoming(eventDate)
Checks if a given timestamp represents an upcoming event.
- Returns: boolean

### Examples
```typescript
import { 
  formatDate, 
  formatRelativeTime, 
  formatDateForCard,
  formatEventDateFriendly,
  isUpcoming 
} from './dateUtils';

// Standard formatting
const formatted = formatDate(Date.now());
const shortDate = formatDateShort(Date.now());

// Event card formatting
const { month, day, weekday } = formatDateForCard(eventTimestamp);
const friendlyDate = formatEventDateFriendly(eventTimestamp);

// Relative time formatting
const relative = formatRelativeTime(lastScrapedTime);
const bidirectional = formatRelativeTimeBidirectional(scheduledTime);
const scheduling = formatSchedulingTime(scheduledTime);

// Utility checks
const upcoming = isUpcoming(eventTimestamp);
```

### Consolidation Notes
These utilities have been extracted from various components to eliminate code duplication. Previously, similar formatting logic was scattered across:
- `SubscriptionsPage.tsx`
- `SourcesListPage.tsx` 
- `EventDetailPage.tsx`
- `EventCard.tsx`
- `AppAdminPage.tsx`
- `EventDebugPage.tsx`
- `SourceDetailPage.tsx`
- `CreateSubscriptionPage.tsx`

All components now use the centralized utilities for consistent date/time formatting.

## useAPIErrorHandler

A custom hook that provides standardized error handling for API calls with toast notifications.

### Features

- **Automatic Toast Notifications**: Shows error messages using sonner toast
- **Flexible Error Message Extraction**: Handles different error types and formats
- **Optional Console Logging**: Configurable error logging for debugging
- **Custom Error Actions**: Execute additional logic when errors occur
- **Memoized Callback**: Uses `useCallback` for performance optimization

### Basic Usage

```tsx
import { useAPIErrorHandler } from "../utils/hooks";

function MyComponent() {
  const mutation = useMutation(api.someEndpoint);
  const handleError = useAPIErrorHandler();

  const handleSubmit = async () => {
    try {
      await mutation({ data });
      toast.success("Success!");
    } catch (error) {
      handleError(error); // Automatically shows toast and logs error
    }
  };
}
```

### Advanced Usage

```tsx
import { useAPIErrorHandler } from "../utils/hooks";

function MyComponent() {
  const handleError = useAPIErrorHandler({
    customMessage: "Failed to save user data",
    logError: true, // Default: true
    onError: (error) => {
      // Additional error handling logic
      setFormErrors(extractFormErrors(error));
      navigate("/error-page");
    },
  });

  // ... rest of component
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `customMessage` | `string` | `undefined` | Custom error message to display instead of extracting from error |
| `logError` | `boolean` | `true` | Whether to log the error to console |
| `onError` | `(error: unknown) => void` | `undefined` | Additional callback to execute after showing toast |

### Error Message Priority

The hook determines the error message in this order:

1. **Custom Message**: If `customMessage` is provided, it's used
2. **Error.message**: If error is an `Error` instance, uses `error.message`
3. **String Error**: If error is a string, uses it directly
4. **Object Message**: If error is an object with a `message` property
5. **Fallback**: "An unexpected error occurred"

### Examples in Different Scenarios

#### Form Submission
```tsx
const handleCreateError = useAPIErrorHandler({
  customMessage: "Failed to create item",
  onError: () => setIsSubmitting(false),
});

const handleSubmit = async (data) => {
  setIsSubmitting(true);
  try {
    await createItem(data);
    toast.success("Item created successfully!");
    onSuccess();
  } catch (error) {
    handleCreateError(error);
  }
};
```

#### Data Fetching with Custom Actions
```tsx
const handleFetchError = useAPIErrorHandler({
  customMessage: "Failed to load data",
  onError: () => {
    setRetryCount(prev => prev + 1);
    setShowRetryButton(true);
  },
});

const fetchData = async () => {
  try {
    const data = await getData();
    setData(data);
  } catch (error) {
    handleFetchError(error);
  }
};
```

#### Silent Error Handling (No Console Log)
```tsx
const handleSilentError = useAPIErrorHandler({
  logError: false,
  customMessage: "Operation failed silently",
});
```

### Migration from Manual Error Handling

#### Before:
```tsx
try {
  await mutation(data);
  toast.success("Success!");
} catch (error) {
  toast.error("Failed to create item");
  console.error("Error:", error);
  setIsSubmitting(false);
}
```

#### After:
```tsx
const handleError = useAPIErrorHandler({
  customMessage: "Failed to create item",
  onError: () => setIsSubmitting(false),
});

try {
  await mutation(data);
  toast.success("Success!");
} catch (error) {
  handleError(error);
}
```

### Best Practices

1. **Reuse Error Handlers**: Create error handlers at the component level for consistent error handling
2. **Specific Messages**: Use descriptive custom messages for better UX
3. **Additional Actions**: Use `onError` callback for cleanup or state updates
4. **Error Boundaries**: Combine with React error boundaries for comprehensive error handling
5. **Type Safety**: The hook accepts `unknown` errors for maximum flexibility

### Performance Considerations

- The hook uses `useCallback` to memoize the error handler
- Dependencies are properly tracked for re-memoization
- Minimal overhead when used in frequently re-rendering components 