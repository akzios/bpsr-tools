/**
 * Data Formatter Utilities
 * Common formatting functions for DPS, damage, time, etc.
 */

import type { ProfessionDetails, ProfessionRole } from '@app-types/index';

/**
 * Format large numbers with K/M/G/T suffixes
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string (e.g., "1.2M", "345.6K")
 */
export function formatStat(value: number, decimals: number = 1): string {
  if (value >= 1000000000000) {
    return (value / 1000000000000).toFixed(decimals) + 'T';
  }
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(decimals) + 'G';
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(decimals) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(decimals) + 'K';
  }
  return Math.round(value).toString();
}

/**
 * Format numbers with fixed decimal places
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with suffixes
 */
export function formatNumber(num: number | undefined | null, decimals: number = 2): string {
  // Handle undefined, null, or NaN values
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }

  if (num >= 1000000) {
    return (num / 1000000).toFixed(decimals) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(decimals) + 'K';
  }
  return num.toFixed(decimals);
}

/**
 * Format duration in milliseconds to HH:MM:SS
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "01:23:45")
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds to M:SS timer
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "2:35")
 */
export function formatTimer(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Format time elapsed since a date
 * @param date - The date to calculate from
 * @returns Human-readable string (e.g., "2m ago", "5s ago")
 */
export function formatTimeSince(date: Date | null): string {
  if (!date) return 'Never';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(seconds / 86400);
    return `${days}d ago`;
  }
}

/**
 * Format percentage with fixed decimal places
 * @param value - The percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string (e.g., "45.2%")
 */
export function formatPercentage(value: number | undefined | null, decimals: number = 1): string {
  // Handle undefined, null, or NaN values
  if (value === undefined || value === null || isNaN(value)) {
    return '0%';
  }
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Calculate and format critical hit percentage
 * @param criticalHits - Number of critical hits
 * @param totalHits - Total number of hits
 * @returns Formatted percentage string
 */
export function formatCritPercentage(criticalHits: number, totalHits: number): string {
  if (totalHits === 0) return '0.0%';
  return ((criticalHits / totalHits) * 100).toFixed(1) + '%';
}

/**
 * Get profession display name (English)
 * @param professionDetails - Profession details object
 * @returns Profession name in English
 */
export function getProfessionName(professionDetails: ProfessionDetails | null | undefined): string {
  if (!professionDetails) return 'Unknown';
  return professionDetails.name_en || 'Unknown';
}

/**
 * Get color for profession by role
 * @param professionDetails - Profession details object
 * @returns CSS color string
 */
export function getProfessionColor(professionDetails: ProfessionDetails | null | undefined): string {
  if (!professionDetails || !professionDetails.role) {
    return '#ef4444'; // Red (DPS default)
  }

  const role = professionDetails.role.toLowerCase() as ProfessionRole;

  switch (role) {
    case 'tank':
      return '#06b6d4'; // Cyan
    case 'healer':
      return '#22c55e'; // Green
    case 'dps':
    default:
      return '#ef4444'; // Red
  }
}

/**
 * Get role color for UI elements
 * @param role - The profession role
 * @returns CSS color string
 */
export function getRoleColor(role: ProfessionRole | string | undefined): string {
  if (!role) return '#ef4444';

  const normalizedRole = role.toLowerCase();
  switch (normalizedRole) {
    case 'tank':
      return '#06b6d4'; // Cyan
    case 'healer':
      return '#22c55e'; // Green
    case 'dps':
    default:
      return '#ef4444'; // Red
  }
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format timestamp to readable date/time
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Format player count
 * @param count - Number of players
 * @returns Formatted string (e.g., "8 players")
 */
export function formatPlayerCount(count: number): string {
  return count === 1 ? '1 player' : `${count} players`;
}
