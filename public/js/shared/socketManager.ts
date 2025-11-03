/**
 * Socket.IO Manager
 * Provides a type-safe wrapper around Socket.IO client for real-time communication
 */

import type { CombatData, EnemyData } from '@app-types/index';

// Socket.IO types (will be available from socket.io-client at runtime)
declare const io: any;

export interface SocketEventHandlers {
  onDataUpdate?: (data: Record<string, CombatData>) => void;
  onEnemiesUpdate?: (enemies: Record<string, EnemyData>) => void;
  onThemeChanged?: (theme: 'light' | 'dark') => void;
  onPauseStateChanged?: (paused: boolean) => void;
  onCombatCleared?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export class SocketManager {
  private socket: any;
  private handlers: SocketEventHandlers = {};

  constructor(serverUrl?: string) {
    this.socket = serverUrl ? io(serverUrl) : io();
    this.setupDefaultListeners();
  }

  /**
   * Setup default socket listeners
   */
  private setupDefaultListeners(): void {
    this.socket.on('connect', () => {
      console.log('[Socket] Connected to server');
      this.handlers.onConnect?.();
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      this.handlers.onDisconnect?.();
    });
  }

  /**
   * Register event handlers
   */
  public on(handlers: SocketEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };

    if (handlers.onDataUpdate) {
      this.socket.on('data', (response: any) => {
        const data = response?.data || response;
        handlers.onDataUpdate?.(data);
      });

      this.socket.on('data-update', (response: any) => {
        const data = response?.data || response;
        handlers.onDataUpdate?.(data);
      });
    }

    if (handlers.onEnemiesUpdate) {
      this.socket.on('enemies', handlers.onEnemiesUpdate);
      this.socket.on('enemies-update', handlers.onEnemiesUpdate);
    }

    if (handlers.onThemeChanged) {
      this.socket.on('theme-changed', (data: any) => {
        handlers.onThemeChanged?.(data.theme);
      });
    }

    if (handlers.onPauseStateChanged) {
      this.socket.on('pause-state-changed', (data: any) => {
        handlers.onPauseStateChanged?.(data.paused);
      });
    }

    if (handlers.onCombatCleared) {
      this.socket.on('combat-cleared', handlers.onCombatCleared);
    }
  }

  /**
   * Request data update from server
   */
  public requestData(): void {
    this.socket.emit('request-data');
  }

  /**
   * Request enemies update from server
   */
  public requestEnemies(): void {
    this.socket.emit('request-enemies');
  }

  /**
   * Clear combat data
   */
  public clearData(): void {
    this.socket.emit('clear-data');
  }

  /**
   * Pause or resume tracking
   */
  public setPauseState(paused: boolean): void {
    this.socket.emit('pause-tracking', paused);
  }

  /**
   * Get the raw socket instance (for advanced use cases)
   */
  public getSocket(): any {
    return this.socket;
  }

  /**
   * Disconnect from server
   */
  public disconnect(): void {
    this.socket.disconnect();
  }

  /**
   * Check if socket is connected
   */
  public isConnected(): boolean {
    return this.socket.connected;
  }
}

/**
 * Create a new socket manager instance
 */
export function createSocketManager(serverUrl?: string): SocketManager {
  return new SocketManager(serverUrl);
}
