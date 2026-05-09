import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge tailwind classes with proper conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Common security event types and their associated visual tokens.
 */
export const SEVERITY_COLORS = {
  critical: '#f43f5e', // rose-500
  high: '#f59e0b',     // amber-500
  medium: '#3b82f6',   // blue-500
  low: '#10b981',      // emerald-500
  info: '#71717a',     // zinc-500
} as const;

export const EVENT_THEMES = {
  exec: { color: '#10b981', icon: '▶' },    // emerald
  connect: { color: '#06b6d4', icon: '🔗' }, // cyan
  exit: { color: '#f43f5e', icon: '⛔' },    // rose
  fork: { color: '#f59e0b', icon: '🌿' },    // amber
  unknown: { color: '#71717a', icon: '❓' }, // zinc
} as const;
