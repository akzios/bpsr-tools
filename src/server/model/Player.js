const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const configPaths = require("../utilities/configPaths");

class PlayerModel {
  constructor(logger, dbPath = null) {
    // Wrap logger with [PlayerDB] prefix
    this.logger = {
      info: (msg) => logger.info(`[PlayerDB] ${msg}`),
      error: (msg) => logger.error(`[PlayerDB] ${msg}`),
      warn: (msg) => logger.warn(`[PlayerDB] ${msg}`),
      debug: (msg) => logger.debug(`[PlayerDB] ${msg}`),
    };
    // Save to db directory (writable in both dev and packaged modes)
    this.dbPath = dbPath || path.join(configPaths.getDbPath(), "bpsr-tools.db");
    this.db = null;
    this.statements = {}; // Cache prepared statements
  }

  /** Initialize database connection and create tables */
  initialize() {
    try {
      // Ensure db directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        this.logger.info(`Created database directory: ${dbDir}`);
      }

      console.log(`[PlayerModel] Initializing database at: ${this.dbPath}`);
      this.logger.info(`Initializing database at: ${this.dbPath}`);

      this.db = new Database(this.dbPath);

      // Optimize for performance
      this.db.pragma("journal_mode = WAL"); // Better performance for concurrent access
      this.db.pragma("synchronous = NORMAL"); // Faster writes (vs FULL)
      this.db.pragma("cache_size = -64000"); // 64MB cache
      this.db.pragma("temp_store = MEMORY"); // Store temp tables in memory

      // Create table and indexes in a single transaction
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS players (
                    player_id INTEGER PRIMARY KEY,
                    name TEXT,
                    profession_id INTEGER,
                    fight_point INTEGER DEFAULT 0,
                    max_hp INTEGER DEFAULT 0,
                    player_level INTEGER,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (profession_id) REFERENCES professions(id)
                );

                CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
                CREATE INDEX IF NOT EXISTS idx_players_updated_at ON players(updated_at);
                CREATE INDEX IF NOT EXISTS idx_players_profession ON players(profession_id);
            `);

      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM players")
        .get();
      this.logger.info(
        `Player database initialized: ${count.count} players cached`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize player database: ${error.message}`,
      );
      throw error;
    }
  }

  /** Prepare statements after professions table is created */
  prepareStatements() {
    try {
      // Prepare frequently used statements for better performance
      this.statements.getPlayer = this.db.prepare(`
                SELECT p.*, pr.name_cn, pr.name_en, pr.icon, pr.role
                FROM players p
                LEFT JOIN professions pr ON p.profession_id = pr.id
                WHERE p.player_id = ?
            `);
      this.statements.updatePlayer = this.db.prepare(`
                UPDATE players
                SET name = ?, profession_id = ?, fight_point = ?, max_hp = ?, player_level = ?, updated_at = datetime('now')
                WHERE player_id = ?
            `);
      this.statements.insertPlayer = this.db.prepare(`
                INSERT INTO players (player_id, name, profession_id, fight_point, max_hp, player_level)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
      this.logger.debug("Player prepared statements created");
    } catch (error) {
      this.logger.error(
        `Failed to prepare player statements: ${error.message}`,
      );
      throw error;
    }
  }

  /** Get player data by player_id
   * @param {string} playerId - Player ID
   * @returns {Object|null} - Player data or null
   */
  getPlayer(playerId) {
    try {
      const id = parseInt(playerId);
      if (isNaN(id)) {
        this.logger.warn(`Invalid player ID: ${playerId}`);
        return null;
      }
      return this.statements.getPlayer.get(id);
    } catch (error) {
      this.logger.error(`Error getting player ${playerId}: ${error.message}`);
      return null;
    }
  }

  /** Convert profession name (Chinese or English) to profession ID
   * @param {string} professionName - Profession name (Chinese or English)
   * @returns {number|null} - Profession ID or null if not found
   */
  getProfessionId(professionName) {
    if (!professionName) {
      return null;
    }

    try {
      // Try to find by Chinese name first
      const stmt = this.db.prepare(`
                SELECT id FROM professions
                WHERE name_cn = ? OR name_en = ? COLLATE NOCASE
                LIMIT 1
            `);
      const result = stmt.get(professionName, professionName);
      return result ? result.id : null;
    } catch (error) {
      this.logger.error(
        `Error getting profession ID for ${professionName}: ${error.message}`,
      );
      return null;
    }
  }

  /** Save or update player data with validation
   * @param {Object} playerData - Player data object
   * @returns {boolean} - Success status
   */
  savePlayer(playerData) {
    const { player_id, name, profession, fight_point, max_hp, player_level } =
      playerData;

    // Validation: don't save if player_id is missing or invalid
    const playerId = parseInt(player_id);
    if (isNaN(playerId)) {
      this.logger.warn(`Cannot save player: invalid player_id (${player_id})`);
      return false;
    }

    try {
      const existing = this.getPlayer(playerId);

      // Convert profession name to ID
      const professionId = profession ? this.getProfessionId(profession) : null;

      // Validation logic
      const validatedData = {
        player_id: playerId,
        name: this.validateName(name, existing?.name),
        profession_id: this.validateProfessionId(
          professionId,
          existing?.profession_id,
        ),
        fight_point: this.validateFightPoint(
          fight_point,
          existing?.fight_point,
        ),
        max_hp: this.validateMaxHp(max_hp, existing?.max_hp),
        player_level:
          player_level !== null && player_level !== undefined
            ? parseInt(player_level)
            : existing?.player_level,
      };

      // Check if anything actually changed
      if (existing && this.dataUnchanged(existing, validatedData)) {
        return true; // No changes needed
      }

      if (existing) {
        // Update existing player using cached prepared statement
        this.statements.updatePlayer.run(
          validatedData.name,
          validatedData.profession_id,
          validatedData.fight_point,
          validatedData.max_hp,
          validatedData.player_level,
          validatedData.player_id,
        );
        this.logger.debug(
          `Updated player ${validatedData.player_id}: ${validatedData.name}`,
        );
      } else {
        // Insert new player using cached prepared statement
        this.statements.insertPlayer.run(
          validatedData.player_id,
          validatedData.name,
          validatedData.profession_id,
          validatedData.fight_point,
          validatedData.max_hp,
          validatedData.player_level,
        );
        this.logger.info(
          `Saved new player ${validatedData.player_id}: ${validatedData.name}`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(`Error saving player ${player_id}: ${error.message}`);
      return false;
    }
  }

  /** Validate name - don't update if empty or "Unknown"
   * @param {string} newName - New name
   * @param {string} existingName - Existing name
   * @returns {string} - Validated name
   */
  validateName(newName, existingName) {
    if (!newName || newName === "" || newName === "Unknown") {
      return existingName || null;
    }
    return newName;
  }

  /** Validate profession ID - don't update if null
   * @param {number|null} newProfessionId - New profession ID
   * @param {number|null} existingProfessionId - Existing profession ID
   * @returns {number|null} - Validated profession ID
   */
  validateProfessionId(newProfessionId, existingProfessionId) {
    // If new profession ID is null, keep existing
    if (newProfessionId === null || newProfessionId === undefined) {
      return existingProfessionId || null;
    }
    return newProfessionId;
  }

  /** Validate fight point - only update if higher or if current is 0
   * @param {number} newFightPoint - New fight point
   * @param {number} existingFightPoint - Existing fight point
   * @returns {number} - Validated fight point
   */
  validateFightPoint(newFightPoint, existingFightPoint) {
    const newFP = parseInt(newFightPoint) || 0;
    const existingFP = parseInt(existingFightPoint) || 0;

    // Don't update to 0 if we have a valid value
    if (newFP === 0 && existingFP > 0) {
      return existingFP;
    }

    // Only update if new value is higher
    return Math.max(newFP, existingFP);
  }

  /** Validate max HP - only update if higher or if current is 0
   * @param {number} newMaxHp - New max HP
   * @param {number} existingMaxHp - Existing max HP
   * @returns {number} - Validated max HP
   */
  validateMaxHp(newMaxHp, existingMaxHp) {
    const newHP = parseInt(newMaxHp) || 0;
    const existingHP = parseInt(existingMaxHp) || 0;

    // Don't update to 0 if we have a valid value
    if (newHP === 0 && existingHP > 0) {
      return existingHP;
    }

    // Only update if new value is higher
    return Math.max(newHP, existingHP);
  }

  /** Check if data is unchanged
   * @param {Object} existing - Existing player data
   * @param {Object} validated - Validated new data
   * @returns {boolean} - True if unchanged
   */
  dataUnchanged(existing, validated) {
    return (
      existing.name === validated.name &&
      existing.profession_id === validated.profession_id &&
      existing.fight_point === validated.fight_point &&
      existing.max_hp === validated.max_hp &&
      existing.player_level === validated.player_level
    );
  }

  /** Load players from JSON file and populate database
   * @param {string} jsonPath - Path to players.json seed file
   */
  loadFromJSON(jsonPath) {
    try {
      // Check if already populated
      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM players")
        .get();
      if (count.count > 0) {
        this.logger.debug("Player table already populated, skipping JSON load");
        return;
      }

      // Read JSON file
      if (!fs.existsSync(jsonPath)) {
        this.logger.warn(`Player seed JSON not found: ${jsonPath}`);
        return;
      }

      const data = fs.readFileSync(jsonPath, "utf8");
      const seedData = JSON.parse(data);

      if (!seedData.players || !Array.isArray(seedData.players)) {
        this.logger.error("Invalid player seed data format");
        return;
      }

      const players = seedData.players;

      // Bulk insert in a transaction for performance
      const insertStmt = this.db.prepare(`
        INSERT INTO players (player_id, name, profession_id, fight_point, max_hp, player_level)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((players) => {
        for (const player of players) {
          insertStmt.run(
            player.player_id,
            player.name,
            player.profession_id,
            player.fight_point || 0,
            player.max_hp || 0,
            player.player_level || null,
          );
        }
      });

      insertMany(players);

      this.logger.info(`Loaded ${players.length} players from JSON seed`);
    } catch (error) {
      this.logger.error(`Error loading players from JSON: ${error.message}`);
    }
  }

  /** Get all players
   * @returns {Array} - Array of all players
   */
  getAllPlayers() {
    try {
      const stmt = this.db.prepare(
        "SELECT * FROM players ORDER BY updated_at DESC",
      );
      return stmt.all();
    } catch (error) {
      this.logger.error(`Error getting all players: ${error.message}`);
      return [];
    }
  }

  /** Get database connection (for use by other models)
   * @returns {Database} - SQLite database instance
   */
  getDB() {
    return this.db;
  }

  /** Close database connection */
  close() {
    if (this.db) {
      this.db.close();
      this.logger.info("Player database closed");
    }
  }
}

module.exports = PlayerModel;
