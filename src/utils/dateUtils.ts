/**
 * Format a timestamp into a localized date string
 */
export function formatDate(timestamp: number | undefined) {
  if (!timestamp) return "Never";
  return new Date(timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a timestamp into a detailed localized date string (for debug pages)
 */
export function formatDateDetailed(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Format a timestamp into a short date string (no time)
 */
export function formatDateShort(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a timestamp as relative time from now (e.g., "2h ago", "3d ago")
 */
export function formatRelativeTime(timestamp: number | undefined) {
  if (!timestamp) return "Never";

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
  const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));

  if (months > 0) return `${months}mo ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

/**
 * Format a timestamp as relative time from now, handling both past and future (e.g., "2h ago", "in 3d")
 */
export function formatRelativeTimeBidirectional(timestamp: number) {
  const now = Date.now();
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    // Past
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  } else {
    // Future
    if (days > 0) return `in ${days}d`;
    if (hours > 0) return `in ${hours}h`;
    return `in ${minutes}m`;
  }
}

/**
 * Format a timestamp into a detailed event date string (for event detail pages)
 */
export function formatEventDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Format time only (hour:minute)
 */
export function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a timestamp for event cards (returns month, day, weekday)
 */
export function formatDateForCard(timestamp: number) {
  const date = new Date(timestamp);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });

  return { month, day, weekday };
}

/**
 * Format a timestamp for scheduling context (shows "Ready to run" for past times)
 */
export function formatSchedulingTime(timestamp: number) {
  const now = Date.now();
  const diff = timestamp - now;

  if (diff <= 0) {
    return "Ready to run";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  } else {
    return `in ${minutes}m`;
  }
}

/**
 * Format a timestamp into a friendly event date string (e.g., "Mon, Dec 15, 2024")
 */
export function formatEventDateFriendly(timestamp: number) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Invalid Date";
  }
}

/**
 * Check if a given timestamp represents an upcoming event
 */
export function isUpcoming(eventDate: number) {
  return eventDate > Date.now();
}
 