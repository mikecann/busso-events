export function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const ret: any = {};
  keys.forEach((key) => {
    ret[key] = obj[key];
  });
  return ret;
}

export function exhaustiveCheck(param: never): never {
  throw new Error(`Exhaustive check failed: ${param}`);
}

export function wait(ms: number) {
  return new Promise((resolve, reject) => setTimeout(resolve, ms));
}

export const iife = <T>(fn: () => T): T => fn();

export const hoursToMilliseconds = (hours: number) => hours * 60 * 60 * 1000;

export const hoursFromNowInMilliseconds = (hours: number) =>
  Date.now() + hoursToMilliseconds(hours);

export const daysToMilliseconds = (days: number) => days * 24 * 60 * 60 * 1000;

export const daysFromNowInMilliseconds = (days: number) =>
  Date.now() + daysToMilliseconds(days);
