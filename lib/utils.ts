// General-purpose utility functions. Keep pure — no side effects, no imports from lib/.

import { type ClassValue, clsx } from 'clsx'

// Merge Tailwind class names safely (use instead of template literals).
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Format a date for display (e.g. "April 18, 2026").
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

// Truncate a string to a max length, appending "…".
export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

// Convert a snake_case or UPPER_CASE string to Title Case.
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Safe JSON parse — returns null on failure instead of throwing.
export function safeJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
