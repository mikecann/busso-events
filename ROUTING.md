# Type-Safe Routing with type-route

This project now uses [type-route](https://type-route.zilch.dev/) for type-safe routing instead of the previous state-based navigation system.

## What Changed

Previously, the app used a simple `useState` approach to manage page navigation with callback props like `onBack`, `onNavigateToLogin`, etc. Now, we have proper URL-based routing with full TypeScript support.

## Benefits

1. **Type Safety**: Routes and their parameters are fully typed
2. **URL Support**: Users can bookmark, share, and navigate via URLs
3. **Better UX**: Browser back/forward buttons work properly
4. **Maintainable**: Centralized route definitions instead of scattered callbacks

## Route Structure

All routes are defined in `src/router.ts`:

### Public Routes
- `/` - Home page with event gallery
- `/event/:eventId` - Event detail page
- `/login` - Login page

### Authenticated Routes
- `/dashboard` - Main dashboard (redirects from `/` when authenticated)
- `/subscriptions` - User subscriptions
- `/subscriptions/create` - Create new subscription
- `/admin` - Admin dashboard (admin only)
- `/admin/sources` - Event sources management (admin only)
- `/admin/sources/add` - Add new event source (admin only)
- `/admin/event/:eventId/debug` - Event debug page (admin only)

## Usage Examples

### Navigation

```tsx
import { navigation } from '../router';

// Navigate programmatically
navigation.eventDetail(eventId).push(); // Push to history
navigation.home().replace(); // Replace current route

// Link component
<Button {...navigation.subscriptions().link}>
  Go to Subscriptions
</Button>
```

### Route Matching

```tsx
import { useRoute } from '../router';

function MyComponent() {
  const route = useRoute();
  
  if (route.name === "eventDetail") {
    // TypeScript knows route.params.eventId exists
    const eventId = route.params.eventId;
    // ...
  }
  
  if (route.name === false) {
    // Handle 404 case
  }
}
```

### Type-Safe Parameters

```tsx
// The router automatically types parameters based on route definitions
// For /event/:eventId, params will be { eventId: string }
// For /admin/event/:eventId/debug, params will be { eventId: string }

// When calling navigation helpers:
navigation.eventDetail("some-event-id"); // ✅ Valid
navigation.eventDetail(); // ❌ TypeScript error - eventId required
```

## Component Updates

### Before (State-based)
```tsx
interface MyPageProps {
  onBack: () => void;
  selectedEventId: Id<"events"> | null;
}

export function MyPage({ onBack, selectedEventId }: MyPageProps) {
  // ...
}
```

### After (Route-based)
```tsx
import { useRoute, navigation } from '../router';

export function MyPage() {
  const route = useRoute();
  
  if (route.name === "eventDetail") {
    const eventId = route.params.eventId; // string from URL
    const typedEventId = eventId as Id<"events">; // cast for Convex
    
    return (
      <div>
        <Button onClick={() => navigation.home().push()}>
          Back
        </Button>
        {/* Use typedEventId for Convex queries */}
      </div>
    );
  }
}
```

## Migration Notes

1. **Parameter Types**: URL parameters come as strings, so cast to `Id<"events">` when needed for Convex queries
2. **Navigation**: Use `navigation.routeName().push()` instead of callback props
3. **Links**: Use `{...navigation.routeName().link}` spread syntax for `<Button>` or `<a>` tags
4. **Route Matching**: Use `route.name === "routeName"` instead of state comparisons

## Adding New Routes

1. Add route definition to `src/router.ts`:
```tsx
export const { RouteProvider, useRoute, routes } = createRouter({
  // ... existing routes
  newRoute: defineRoute(
    { param: param.path.string }, // optional parameters
    (p) => `/new-route/${p.param}` // path pattern
  ),
});
```

2. Add navigation helper:
```tsx
export const navigation = {
  // ... existing helpers
  newRoute: (param: string) => routes.newRoute({ param }),
} as const;
```

3. Handle the route in your components:
```tsx
{route.name === "newRoute" && (
  <NewRouteComponent param={route.params.param} />
)}
```

## Best Practices

1. Always use the `navigation` helpers instead of manually constructing routes
2. Cast URL parameters to proper types when passing to Convex queries
3. Handle the `route.name === false` case for 404 pages
4. Use `push()` for normal navigation, `replace()` for redirects
5. Keep route definitions in `src/router.ts` centralized and organized 