/**
 * Session Helper Functions
 * Shared utilities for session management
 */

import { API_ENDPOINTS } from '@shared/constants';
import { detectSessionType } from '@shared/sessionTypeDetector';
import type { DetectionContext } from '@shared/sessionTypeDetector';
import type { SessionType } from '@app-types/index';

/**
 * Save session with provided combat data
 * @param sessionName Optional session name
 * @param sessionType Session type (Parse, Dungeon, Raid, Guild Hunt, Boss Crusade, Open World)
 * @param combatData Combat data to save
 * @returns Session ID if successful, null otherwise
 */
export async function saveSession(sessionName: string | undefined, sessionType: string | undefined, combatData: any): Promise<number | null> {
  try {
    if (!combatData || Object.keys(combatData).length === 0) {
      console.log('[SessionHelpers] No combat data to save');
      return null;
    }

    // Create session
    const name = sessionName || `Session ${new Date().toLocaleString()}`;
    const type = sessionType || 'Open World';
    const createResponse = await fetch('/api/sessions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_name: name,
        type: type,
        start_time: Date.now(),
      }),
    });

    const createResult = await createResponse.json();
    console.log('[SessionHelpers] Create response:', createResult);

    // API returns session_id in data object
    const sessionId = createResult.data?.session_id;

    if (!sessionId) {
      console.error('[SessionHelpers] No session ID returned from create');
      return null;
    }

    // Save combat data to session
    const saveResponse = await fetch(`/api/sessions/${sessionId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ combatData }),
    });

    const saveResult = await saveResponse.json();
    console.log('[SessionHelpers] Save response:', saveResult);

    if (saveResult.code !== 0) {
      console.error('[SessionHelpers] Failed to save combat data');
      return null;
    }

    console.log('[SessionHelpers] Session saved:', sessionId);
    return sessionId;
  } catch (error) {
    console.error('[SessionHelpers] Error saving session:', error);
    return null;
  }
}

/**
 * Save current combat data as a session (fetches from API)
 * @param sessionName Optional custom session name
 * @param sessionType Optional session type
 * @returns Session ID if successful, null otherwise
 */
export async function saveCurrentSession(sessionName?: string, sessionType?: string): Promise<number | null> {
  try {
    // Get current combat data from API
    const response = await fetch(API_ENDPOINTS.DATA);
    const result = await response.json();

    // API returns { code: 0, user: {...}, data: {...} }
    // We need the 'user' object which contains combat data keyed by UID
    const combatData = result.user || {};

    console.log('[SessionHelpers] Fetched combat data, player count:', Object.keys(combatData).length);

    // Use the shared saveSession function
    return await saveSession(sessionName, sessionType, combatData);
  } catch (error) {
    console.error('[SessionHelpers] Error saving session:', error);
    return null;
  }
}

/**
 * Delete a session by ID
 * @param sessionId Session ID to delete
 * @returns True if successful, false otherwise
 */
export async function deleteSession(sessionId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete session');
    }

    console.log('[SessionHelpers] Session deleted:', sessionId);
    return true;
  } catch (error) {
    console.error('[SessionHelpers] Error deleting session:', error);
    return false;
  }
}

/**
 * Fetch all sessions
 * @param limit Number of sessions to fetch
 * @param offset Offset for pagination
 * @returns Array of sessions
 */
export async function fetchSessions(limit: number = 50, offset: number = 0): Promise<any[]> {
  try {
    const response = await fetch(`/api/sessions/list?limit=${limit}&offset=${offset}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('[SessionHelpers] Error fetching sessions:', error);
    return [];
  }
}

/**
 * Detect session type from current combat data
 * @param isParseMode Whether parse mode is currently active
 * @returns Detected session type
 */
export async function detectCurrentSessionType(isParseMode: boolean = false): Promise<SessionType> {
  try {
    // Fetch combat data
    const dataResponse = await fetch(API_ENDPOINTS.DATA);
    const dataResult = await dataResponse.json();
    const combatData = dataResult.user || {};

    // Fetch enemy data
    const enemiesResponse = await fetch(API_ENDPOINTS.ENEMIES);
    const enemiesResult = await enemiesResponse.json();
    const enemies = enemiesResult.data || [];

    // Calculate total damage and duration
    const players = Object.values(combatData) as any[];
    const totalDamage = players.reduce((sum: number, player: any) => sum + (player.totalDamage || 0), 0);

    // Calculate duration from first player (they should all have similar durations)
    const firstPlayer = players[0];
    const duration = firstPlayer?.fightTime || 0; // in seconds

    // Build detection context
    const context: DetectionContext = {
      playerCount: players.length,
      isParseMode,
      monsters: enemies.map((enemy: any) => ({
        name_en: enemy.name_en || '',
        name_cn: enemy.name_cn || '',
        monster_type: enemy.monster_type || 0,
      })),
      totalDamage,
      duration,
    };

    const detectedType = detectSessionType(context);
    console.log('[SessionHelpers] Detected session type:', detectedType, 'Context:', context);

    return detectedType;
  } catch (error) {
    console.error('[SessionHelpers] Error detecting session type:', error);
    return 'Open World'; // Default fallback
  }
}

/**
 * Check if auto-save should trigger and save if conditions are met
 * @param trigger The auto-save trigger type ('onClear', 'onInactivity', 'onWindowClose')
 * @param isParseMode Whether parse mode is currently active
 * @returns True if session was saved, false otherwise
 */
export async function checkAndAutoSave(trigger: 'onClear' | 'onInactivity' | 'onWindowClose', isParseMode: boolean = false): Promise<boolean> {
  try {
    // Fetch settings
    const settingsResponse = await fetch(API_ENDPOINTS.SETTINGS);
    const settingsResult = await settingsResponse.json();
    const settings = settingsResult.data || settingsResult;
    const autoSave = settings.autoSave || {};

    // Check if auto-save is enabled and this trigger is enabled
    if (!autoSave.enabled || !autoSave[trigger]) {
      console.log(`[SessionHelpers] Auto-save not enabled for trigger: ${trigger}`);
      return false;
    }

    // Fetch current combat data
    const dataResponse = await fetch(API_ENDPOINTS.DATA);
    const dataResult = await dataResponse.json();
    const combatData = dataResult.user || {};

    // Check if there's any combat data
    if (Object.keys(combatData).length === 0) {
      console.log('[SessionHelpers] No combat data available for auto-save');
      return false;
    }

    // Calculate session metrics
    const players = Object.values(combatData) as any[];
    const playerCount = players.length;

    // Calculate total damage across all players
    const totalDamage = players.reduce((sum: number, player: any) => {
      // totalDamage is an object with breakdown stats
      let damage = 0;
      if (typeof player.totalDamage === 'object' && player.totalDamage) {
        // Use total field from damage stats breakdown
        damage = player.totalDamage.total || 0;
      } else if (typeof player.totalDamage === 'number') {
        // Fallback for legacy format
        damage = player.totalDamage;
      }
      return sum + damage;
    }, 0);

    // Calculate duration from totalDamage and totalDps
    // Duration = totalDamage / totalDps (in seconds)
    const firstPlayer = players[0];
    let duration = 0;
    if (firstPlayer?.totalDps && firstPlayer.totalDps > 0) {
      // Get total damage from stats breakdown object
      const playerDamage = typeof firstPlayer.totalDamage === 'object'
        ? (firstPlayer.totalDamage?.total || 0)
        : (firstPlayer.totalDamage || 0);
      duration = Math.round(playerDamage / firstPlayer.totalDps);
    }

    console.log('[SessionHelpers] Calculated duration:', duration, 'seconds from damage:',
      typeof firstPlayer?.totalDamage === 'object' ? firstPlayer.totalDamage?.total : firstPlayer?.totalDamage,
      'and DPS:', firstPlayer?.totalDps);

    // Check thresholds (use ?? instead of || to handle 0 values correctly)
    const meetsMinPlayers = playerCount >= (autoSave.minPlayers ?? 1);
    const meetsMinDuration = duration >= (autoSave.minDuration ?? 0);
    const meetsMinDamage = totalDamage >= (autoSave.minTotalDamage ?? 0);

    console.log('[SessionHelpers] Auto-save check:', {
      trigger,
      enabled: autoSave.enabled,
      triggerEnabled: autoSave[trigger],
      playerCount,
      minPlayers: autoSave.minPlayers,
      meetsMinPlayers,
      duration,
      minDuration: autoSave.minDuration,
      meetsMinDuration,
      totalDamage,
      minTotalDamage: autoSave.minTotalDamage,
      meetsMinDamage,
    });

    // If all thresholds are met, auto-save
    if (meetsMinPlayers && meetsMinDuration && meetsMinDamage) {
      // Detect session type
      const sessionType = await detectCurrentSessionType(isParseMode);

      // Generate auto-save name: "{TYPE} {Date} {Time}"
      const now = new Date();
      const date = now.toLocaleDateString();
      const time = now.toLocaleTimeString();
      const sessionName = `${sessionType} ${date} ${time}`;

      // Save session
      console.log('[SessionHelpers] Auto-saving session:', sessionName);
      const sessionId = await saveSession(sessionName, sessionType, combatData);

      if (sessionId) {
        console.log('[SessionHelpers] Session auto-saved successfully:', sessionId);
        return true;
      }
    } else {
      console.log('[SessionHelpers] Session does not meet auto-save thresholds');
    }

    return false;
  } catch (error) {
    console.error('[SessionHelpers] Error in auto-save check:', error);
    return false;
  }
}
