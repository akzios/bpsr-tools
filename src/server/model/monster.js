const path = require("path");
const fs = require("fs");

class MonsterModel {
  constructor(logger, db) {
    // Wrap logger with [MonsterDB] prefix
    this.logger = {
      info: (msg) => logger.info(`[MonsterDB] ${msg}`),
      error: (msg) => logger.error(`[MonsterDB] ${msg}`),
      warn: (msg) => logger.warn(`[MonsterDB] ${msg}`),
      debug: (msg) => logger.debug(`[MonsterDB] ${msg}`),
    };
    this.db = db;
    this.statements = {}; // Cache prepared statements
  }

  /** Initialize monster table and prepare statements */
  initialize() {
    try {
      // Create table if not exists
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS monsters (
                    id INTEGER PRIMARY KEY,
                    name_cn TEXT NOT NULL,
                    name_en TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                );

                CREATE INDEX IF NOT EXISTS idx_monsters_name_cn ON monsters(name_cn);
                CREATE INDEX IF NOT EXISTS idx_monsters_name_en ON monsters(name_en);
            `);

      // Prepare statements
      this.statements.getMonster = this.db.prepare(
        "SELECT * FROM monsters WHERE id = ?",
      );
      this.statements.insertMonster = this.db.prepare(`
                INSERT OR REPLACE INTO monsters (id, name_cn, name_en)
                VALUES (?, ?, ?)
            `);
      this.statements.getAllMonsters = this.db.prepare(
        "SELECT * FROM monsters",
      );

      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM monsters")
        .get();
      this.logger.info(
        `Monster table initialized: ${count.count} monsters cached`,
      );
    } catch (error) {
      this.logger.error(`Failed to initialize monster table: ${error.message}`);
      throw error;
    }
  }

  /** Load monsters from JSON file and populate database
   * @param {string} jsonPath - Path to monsters.json seed file
   */
  loadFromJSON(jsonPath) {
    try {
      // Check if already populated
      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM monsters")
        .get();
      if (count.count > 0) {
        this.logger.debug(
          "Monster table already populated, skipping JSON load",
        );
        return;
      }

      // Read JSON file
      if (!fs.existsSync(jsonPath)) {
        this.logger.warn(`Monster names JSON not found: ${jsonPath}`);
        return;
      }

      const data = fs.readFileSync(jsonPath, "utf8");
      const monsters = JSON.parse(data);

      // Insert all monsters in a transaction for better performance
      const insert = this.db.transaction((monsters) => {
        for (const [id, name_cn] of Object.entries(monsters)) {
          const monsterId = parseInt(id);
          if (!isNaN(monsterId)) {
            this.statements.insertMonster.run(monsterId, name_cn, null);
          } else {
            this.logger.warn(`Skipping invalid monster ID: ${id}`);
          }
        }
      });

      insert(monsters);

      const newCount = this.db
        .prepare("SELECT COUNT(*) as count FROM monsters")
        .get();
      this.logger.info(
        `Loaded ${newCount.count} monsters from JSON into database`,
      );
    } catch (error) {
      this.logger.error(`Error loading monsters from JSON: ${error.message}`);
    }
  }

  /** Get monster by ID
   * @param {string|number} monsterId - Monster ID
   * @returns {Object|null} - Monster data with id, name_cn, name_en
   */
  getMonster(monsterId) {
    try {
      const id = parseInt(monsterId);
      if (isNaN(id)) {
        this.logger.warn(`Invalid monster ID: ${monsterId}`);
        return null;
      }
      return this.statements.getMonster.get(id);
    } catch (error) {
      this.logger.error(`Error getting monster ${monsterId}: ${error.message}`);
      return null;
    }
  }

  /** Get monster name (prefers English, falls back to Chinese)
   * @param {string|number} monsterId - Monster ID
   * @returns {string|null} - Monster name or null
   */
  getMonsterName(monsterId) {
    const monster = this.getMonster(monsterId);
    if (!monster) return null;

    // Prefer English name if available, otherwise use Chinese
    return monster.name_en || monster.name_cn;
  }

  /** Add or update monster
   * @param {string|number} id - Monster ID
   * @param {string} name_cn - Chinese name
   * @param {string} name_en - English name (optional)
   * @returns {boolean} - Success status
   */
  saveMonster(id, name_cn, name_en = null) {
    try {
      const monsterId = parseInt(id);
      if (isNaN(monsterId) || !name_cn) {
        this.logger.warn(
          `Cannot save monster: invalid id (${id}) or missing name_cn`,
        );
        return false;
      }

      this.statements.insertMonster.run(monsterId, name_cn, name_en);
      return true;
    } catch (error) {
      this.logger.error(`Error saving monster ${id}: ${error.message}`);
      return false;
    }
  }

  /** Get all monsters
   * @returns {Array} - Array of all monsters
   */
  getAllMonsters() {
    try {
      return this.statements.getAllMonsters.all();
    } catch (error) {
      this.logger.error(`Error getting all monsters: ${error.message}`);
      return [];
    }
  }
}

module.exports = MonsterModel;
