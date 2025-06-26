export const hoursToMilliseconds = (hours: number) => hours * 60 * 60 * 1000;

export const hoursFromNowInMilliseconds = (hours: number) =>
  Date.now() + hoursToMilliseconds(hours);

export const daysToMilliseconds = (days: number) => days * 24 * 60 * 60 * 1000;

export const daysFromNowInMilliseconds = (days: number) =>
  Date.now() + daysToMilliseconds(days);

export const iife = <T>(fn: () => T): T => fn();
