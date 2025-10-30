/**
 * ResQLink Utilities
 * Common utility functions for the application
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * @param {T} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {(...args: Parameters<T>) => void} The new debounced function.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttles function execution to at most once per specified interval.
 * @param {T} func The function to throttle.
 * @param {number} interval The throttle interval in milliseconds.
 * @returns {(...args: Parameters<T>) => void} The new throttled function.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= interval) {
      lastCallTime = now;
      func(...args);
    } else {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        func(...args);
      }, interval - timeSinceLastCall);
    }
  };
}

/**
 * Delays execution for the specified number of milliseconds.
 * @param {number} ms The number of milliseconds to delay.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a random string of specified length.
 * @param {number} length The length of the random string.
 * @returns {string} The generated random string.
 */
export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Safely parses JSON with error handling.
 * @param {string} json The JSON string to parse.
 * @returns {T | null} The parsed JSON object, or null if parsing fails.
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Formats bytes into a human-readable string.
 * @param {number} bytes The number of bytes.
 * @param {number} [decimals=2] The number of decimal places to use.
 * @returns {string} The formatted string.
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 * @param {number} ms The duration in milliseconds.
 * @returns {string} The formatted string.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} value The value to clamp.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {number} The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Checks if a value is not null and not undefined.
 * @param {T | null | undefined} value The value to check.
 * @returns {value is T} Whether the value is not null and not undefined.
 */
export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Groups an array of items by a key function.
 * @param {T[]} array The array to group.
 * @param {(item: T) => K} keyFn The function to generate the key for each item.
 * @returns {Record<K, T[]>} An object with the grouped items.
 */
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

/**
 * Creates an array of unique values from an array.
 * @param {T[]} array The array to get unique values from.
 * @returns {T[]} An array of unique values.
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Checks if two arrays are equal (shallow comparison).
 * @param {T[]} a The first array.
 * @param {T[]} b The second array.
 * @returns {boolean} Whether the arrays are equal.
 */
export function arrayEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

/**
 * Retries a promise-returning function with exponential backoff.
 * @param {() => Promise<T>} fn The function to retry.
 * @param {number} [maxAttempts=3] The maximum number of attempts.
 * @param {number} [baseDelay=1000] The base delay in milliseconds.
 * @returns {Promise<T>} The result of the function.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delayMs = baseDelay * Math.pow(2, attempt - 1);
      await delay(delayMs);
    }
  }

  throw lastError!;
}

/**
 * Creates a promise that resolves after a timeout or rejects if the source promise takes too long.
 * @param {Promise<T>} promise The source promise.
 * @param {number} timeoutMs The timeout in milliseconds.
 * @returns {Promise<T>} A new promise that resolves or rejects with a timeout.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
}