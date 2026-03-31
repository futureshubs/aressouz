/**
 * Utility function for merging class names
 * Production-ready className utility with Tailwind CSS support
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
