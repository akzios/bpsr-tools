class SessionModel {
  constructor(logger, db) {
    // Wrap logger with [SessionDB] prefix
    this.logger = {
      info: (msg) => logger.info(`[SessionDB] ${msg}`),
      error: (msg) => logger.error(`[SessionDB] ${msg}`),
      warn: (msg) => logger.warn(`[SessionDB] ${msg}`),
      debug: (msg) => logger.debug(`[SessionDB] ${msg}`),
    };
    this.db = db;
    this.statements = {}; // Cache prepared statements
  }

  /** Initialize database tables */
  initialize() {
    try {

      // Create sessions table
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_name TEXT,
                    notes TEXT,
                    type TEXT DEFAULT 'Open World',
                    start_time INTEGER NOT NULL,
                    end_time INTEGER,
                    duration INTEGER,
                    total_damage INTEGER DEFAULT 0,
                    total_healing INTEGER DEFAULT 0,
                    avg_dps REAL DEFAULT 0,
                    avg_hps REAL DEFAULT 0,
                    max_dps REAL DEFAULT 0,
                    max_hps REAL DEFAULT 0,
                    player_count INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                );

                CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
                CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
                CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
                CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
            `);

      // Create session_players table (junction table for many-to-many relationship)
      // First create if not exists
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS session_players (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    player_id INTEGER NOT NULL,
                    player_name TEXT,
                    profession_id INTEGER,
                    total_damage INTEGER DEFAULT 0,
                    total_healing INTEGER DEFAULT 0,
                    total_dps REAL DEFAULT 0,
                    total_hps REAL DEFAULT 0,
                    max_dps REAL DEFAULT 0,
                    max_hps REAL DEFAULT 0,
                    fight_point INTEGER DEFAULT 0,
                    total_count INTEGER DEFAULT 0,
                    taken_damage INTEGER DEFAULT 0,
                    dead_count INTEGER DEFAULT 0,
                    hp INTEGER DEFAULT 0,
                    max_hp INTEGER DEFAULT 0,
                    skill_breakdown TEXT,
                    time_series_data TEXT,
                    target_damage TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                    FOREIGN KEY (player_id) REFERENCES players(player_id),
                    FOREIGN KEY (profession_id) REFERENCES professions(id),
                    UNIQUE(session_id, player_id)
                );

                CREATE INDEX IF NOT EXISTS idx_session_players_session ON session_players(session_id);
                CREATE INDEX IF NOT EXISTS idx_session_players_player ON session_players(player_id);
                CREATE INDEX IF NOT EXISTS idx_session_players_dps ON session_players(total_dps DESC);
            `);

      // Migrate existing sessions table to new schema (add notes and type columns)
      const sessionsTableInfo = this.db.pragma('table_info(sessions)');
      const sessionsColumnNames = sessionsTableInfo.map(col => col.name);

      if (!sessionsColumnNames.includes('notes')) {
        this.logger.info('Adding notes column to sessions table');
        this.db.exec('ALTER TABLE sessions ADD COLUMN notes TEXT');
      }

      if (!sessionsColumnNames.includes('type')) {
        this.logger.info('Adding type column to sessions table');
        this.db.exec("ALTER TABLE sessions ADD COLUMN type TEXT DEFAULT 'Open World'");
      }

      // Migrate existing session_players table to new schema (add missing columns)
      const tableInfo = this.db.pragma('table_info(session_players)');
      const columnNames = tableInfo.map(col => col.name);

      const newColumns = [
        { name: 'total_count', type: 'INTEGER DEFAULT 0' },
        { name: 'taken_damage', type: 'INTEGER DEFAULT 0' },
        { name: 'dead_count', type: 'INTEGER DEFAULT 0' },
        { name: 'hp', type: 'INTEGER DEFAULT 0' },
        { name: 'max_hp', type: 'INTEGER DEFAULT 0' },
        { name: 'target_damage', type: 'TEXT' },
      ];

      newColumns.forEach(col => {
        if (!columnNames.includes(col.name)) {
          this.logger.info(`Adding column ${col.name} to session_players table`);
          this.db.exec(`ALTER TABLE session_players ADD COLUMN ${col.name} ${col.type}`);
        }
      });

      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM sessions")
        .get();
      this.logger.info(
        `Session database initialized: ${count.count} sessions stored`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize session database: ${error.message}`,
      );
      throw error;
    }
  }

  /** Prepare statements for better performance */
  prepareStatements() {
    try {
      // Session statements
      this.statements.createSession = this.db.prepare(`
                INSERT INTO sessions (session_name, type, start_time, is_active)
                VALUES (?, ?, ?, 1)
            `);

      this.statements.getSession = this.db.prepare(`
                SELECT * FROM sessions WHERE id = ?
            `);

      this.statements.getAllSessions = this.db.prepare(`
                SELECT * FROM sessions ORDER BY start_time DESC LIMIT ? OFFSET ?
            `);

      this.statements.getActiveSessions = this.db.prepare(`
                SELECT * FROM sessions WHERE is_active = 1 ORDER BY start_time DESC
            `);

      this.statements.updateSession = this.db.prepare(`
                UPDATE sessions
                SET end_time = ?,
                    duration = ?,
                    total_damage = ?,
                    total_healing = ?,
                    avg_dps = ?,
                    avg_hps = ?,
                    max_dps = ?,
                    max_hps = ?,
                    player_count = ?,
                    is_active = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `);

      this.statements.deleteSession = this.db.prepare(`
                DELETE FROM sessions WHERE id = ?
            `);

      // Session player statements
      this.statements.addSessionPlayer = this.db.prepare(`
                INSERT OR REPLACE INTO session_players
                (session_id, player_id, player_name, profession_id, total_damage, total_healing,
                 total_dps, total_hps, max_dps, max_hps, fight_point, total_count, taken_damage,
                 dead_count, hp, max_hp, skill_breakdown, time_series_data, target_damage)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

      this.statements.getSessionPlayers = this.db.prepare(`
                SELECT sp.*, pr.name_cn, pr.name_en, pr.icon, pr.role
                FROM session_players sp
                LEFT JOIN professions pr ON sp.profession_id = pr.id
                WHERE sp.session_id = ?
                ORDER BY sp.total_dps DESC
            `);

      this.logger.debug("Session prepared statements created");
    } catch (error) {
      this.logger.error(
        `Failed to prepare session statements: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Create a new session
   * @param {string} sessionName - Optional name for the session
   * @param {string} type - Session type (Parse, Dungeon, Raid, Guild Hunt, Boss Crusade, Open World)
   * @param {number} startTime - Unix timestamp in milliseconds
   * @returns {number} - Session ID
   */
  createSession(sessionName = null, type = 'Open World', startTime = Date.now()) {
    try {
      const result = this.statements.createSession.run(sessionName, type, startTime);
      this.logger.info(`Session created with ID: ${result.lastInsertRowid}`);
      return result.lastInsertRowid;
    } catch (error) {
      this.logger.error(`Failed to create session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param {number} sessionId
   * @returns {object|null} - Session object or null if not found
   */
  getSession(sessionId) {
    try {
      return this.statements.getSession.get(sessionId);
    } catch (error) {
      this.logger.error(`Failed to get session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all sessions with pagination
   * @param {number} limit - Number of sessions to return
   * @param {number} offset - Offset for pagination
   * @returns {array} - Array of session objects
   */
  getAllSessions(limit = 50, offset = 0) {
    try {
      const sessions = this.statements.getAllSessions.all(limit, offset);
      return sessions.map(session => ({
        id: session.id,
        session_name: session.session_name,
        notes: session.notes,
        type: session.type,
        start_time: session.start_time,
        end_time: session.end_time,
        duration: session.duration,
        totalDamage: session.total_damage,
        totalHealing: session.total_healing,
        avg_dps: session.avg_dps,
        avg_hps: session.avg_hps,
        max_dps: session.max_dps,
        maxHps: session.max_hps,
        player_count: session.player_count,
        is_active: session.is_active,
        created_at: session.created_at,
        updated_at: session.updated_at,
      }));
    } catch (error) {
      this.logger.error(`Failed to get all sessions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active sessions
   * @returns {array} - Array of active session objects
   */
  getActiveSessions() {
    try {
      const sessions = this.statements.getActiveSessions.all();
      return sessions.map(session => ({
        id: session.id,
        session_name: session.session_name,
        notes: session.notes,
        type: session.type,
        start_time: session.start_time,
        end_time: session.end_time,
        duration: session.duration,
        totalDamage: session.total_damage,
        totalHealing: session.total_healing,
        avg_dps: session.avg_dps,
        avg_hps: session.avg_hps,
        max_dps: session.max_dps,
        maxHps: session.max_hps,
        player_count: session.player_count,
        is_active: session.is_active,
        created_at: session.created_at,
        updated_at: session.updated_at,
      }));
    } catch (error) {
      this.logger.error(`Failed to get active sessions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update session
   * @param {number} sessionId
   * @param {object} data - Session data to update
   */
  updateSession(sessionId, data) {
    try {
      this.statements.updateSession.run(
        data.end_time,
        data.duration,
        data.total_damage,
        data.total_healing,
        data.avg_dps,
        data.avg_hps,
        data.max_dps,
        data.max_hps,
        data.player_count,
        data.is_active,
        sessionId,
      );
      this.logger.info(`Session ${sessionId} updated`);
    } catch (error) {
      this.logger.error(`Failed to update session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update session metadata (name, notes, and/or type)
   * @param {number} sessionId
   * @param {object} data - { session_name?, notes?, type? }
   */
  updateSessionMetadata(sessionId, data) {
    try {
      const updates = [];
      const params = [];

      if (data.session_name !== undefined) {
        updates.push('session_name = ?');
        params.push(data.session_name);
      }

      if (data.notes !== undefined) {
        updates.push('notes = ?');
        params.push(data.notes);
      }

      if (data.type !== undefined) {
        updates.push('type = ?');
        params.push(data.type);
      }

      if (updates.length === 0) {
        this.logger.warn('No metadata to update');
        return;
      }

      updates.push('updated_at = datetime(\'now\')');
      params.push(sessionId);

      const query = `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`;
      this.db.prepare(query).run(...params);
      this.logger.info(`Session ${sessionId} metadata updated`);
    } catch (error) {
      this.logger.error(`Failed to update session metadata: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete session
   * @param {number} sessionId
   */
  deleteSession(sessionId) {
    try {
      this.statements.deleteSession.run(sessionId);
      this.logger.info(`Session ${sessionId} deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add or update player data for a session
   * @param {number} sessionId
   * @param {object} playerData - Player statistics
   */
  addSessionPlayer(sessionId, playerData) {
    try {
      this.statements.addSessionPlayer.run(
        sessionId,
        playerData.player_id,
        playerData.player_name,
        playerData.profession_id,
        playerData.total_damage,
        playerData.total_healing,
        playerData.total_dps,
        playerData.total_hps,
        playerData.max_dps,
        playerData.max_hps,
        playerData.fight_point,
        playerData.total_count || 0,
        playerData.taken_damage || 0,
        playerData.dead_count || 0,
        playerData.hp || 0,
        playerData.max_hp || 0,
        JSON.stringify(playerData.skill_breakdown || {}),
        JSON.stringify(playerData.time_series_data || []),
        JSON.stringify(playerData.target_damage || []),
      );
      this.logger.debug(
        `Player ${playerData.player_id} added to session ${sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to add session player: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all players for a session
   * @param {number} sessionId
   * @returns {array} - Array of player objects with profession details
   */
  getSessionPlayers(sessionId) {
    try {
      const players = this.statements.getSessionPlayers.all(sessionId);
      return players.map((player) => ({
        id: player.id,
        session_id: player.session_id,
        player_id: player.player_id,
        player_name: player.player_name,
        profession_id: player.profession_id,
        totalDamage: player.total_damage,
        totalHealing: player.total_healing,
        totalDps: player.total_dps,
        totalHps: player.total_hps,
        max_dps: player.max_dps,
        maxHps: player.max_hps,
        fight_point: player.fight_point,
        total_count: player.total_count,
        taken_damage: player.taken_damage,
        dead_count: player.dead_count,
        hp: player.hp,
        max_hp: player.max_hp,
        skill_breakdown: JSON.parse(player.skill_breakdown || "{}"),
        time_series_data: JSON.parse(player.time_series_data || "[]"),
        target_damage: JSON.parse(player.target_damage || "[]"),
        professionDetails: {
          id: player.profession_id,
          name_cn: player.name_cn,
          name_en: player.name_en,
          icon: player.icon,
          role: player.role,
        },
        created_at: player.created_at,
      }));
    } catch (error) {
      this.logger.error(`Failed to get session players: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get session with full details (players)
   * @param {number} sessionId
   * @returns {object} - Complete session object
   */
  getSessionWithDetails(sessionId) {
    try {
      const session = this.getSession(sessionId);
      if (!session) return null;

      const players = this.getSessionPlayers(sessionId);

      return {
        id: session.id,
        session_name: session.session_name,
        notes: session.notes,
        type: session.type,
        start_time: session.start_time,
        end_time: session.end_time,
        duration: session.duration,
        totalDamage: session.total_damage,
        totalHealing: session.total_healing,
        avg_dps: session.avg_dps,
        avg_hps: session.avg_hps,
        max_dps: session.max_dps,
        maxHps: session.max_hps,
        player_count: session.player_count,
        is_active: session.is_active,
        created_at: session.created_at,
        updated_at: session.updated_at,
        players,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get session with details: ${error.message}`,
      );
      throw error;
    }
  }

}

module.exports = SessionModel;
