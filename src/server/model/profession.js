const path = require("path");
const fs = require("fs");
const configPaths = require("../utilities/configPaths");

class ProfessionModel {
  constructor(logger, db) {
    // Wrap logger with [Profession] prefix
    this.logger = {
      info: (msg) => logger.info(`[Profession] ${msg}`),
      error: (msg) => logger.error(`[Profession] ${msg}`),
      warn: (msg) => logger.warn(`[Profession] ${msg}`),
      debug: (msg) => logger.debug(`[Profession] ${msg}`),
    };
    this.db = db;
    this.statements = {}; // Cache prepared statements
  }

  /** Initialize professions table and prepare statements */
  initialize() {
    try {
      // Create professions table
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS professions (
                    id INTEGER PRIMARY KEY,
                    name_cn TEXT NOT NULL,
                    name_en TEXT,
                    icon TEXT,
                    role TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                );

                CREATE INDEX IF NOT EXISTS idx_professions_name_cn ON professions(name_cn);
                CREATE INDEX IF NOT EXISTS idx_professions_name_en ON professions(name_en);
            `);

      // Prepare statements
      this.statements.getProfession = this.db.prepare(
        "SELECT * FROM professions WHERE id = ?",
      );
      this.statements.getProfessionByCN = this.db.prepare(
        "SELECT * FROM professions WHERE name_cn = ?",
      );
      this.statements.getProfessionByEN = this.db.prepare(
        "SELECT * FROM professions WHERE name_en = ?",
      );
      this.statements.insertProfession = this.db.prepare(`
                INSERT OR REPLACE INTO professions (id, name_cn, name_en, icon, role)
                VALUES (?, ?, ?, ?, ?)
            `);
      this.statements.getAllProfessions = this.db.prepare(
        "SELECT * FROM professions",
      );

      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM professions")
        .get();

      this.logger.info(
        `Profession table initialized: ${count.count} professions`,
      );

      // Auto-seed professions if table is empty
      if (count.count === 0) {
        this.logger.info(
          "Profession table is empty, auto-seeding from JSON...",
        );
        const seedPath = configPaths.getDbSeedPath("professions.json");
        if (fs.existsSync(seedPath)) {
          this.loadFromJSON(seedPath);
          const newCount = this.db
            .prepare("SELECT COUNT(*) as count FROM professions")
            .get();
          this.logger.info(`Auto-seeded ${newCount.count} professions`);
        } else {
          this.logger.warn(`Profession seed file not found: ${seedPath}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize profession table: ${error.message}`,
      );
      throw error;
    }
  }

  /** Get profession by ID
   * @param {string|number} professionId - Profession ID
   * @returns {Object|null} - Profession data
   */
  getProfession(professionId) {
    try {
      const id = parseInt(professionId);
      if (isNaN(id)) {
        this.logger.warn(`Invalid profession ID: ${professionId}`);
        return null;
      }
      return this.statements.getProfession.get(id);
    } catch (error) {
      this.logger.error(
        `Error getting profession ${professionId}: ${error.message}`,
      );
      return null;
    }
  }

  /** Get profession by Chinese name
   * @param {string} nameCN - Chinese name
   * @returns {Object|null} - Profession data
   */
  getProfessionByCN(nameCN) {
    try {
      return this.statements.getProfessionByCN.get(nameCN);
    } catch (error) {
      this.logger.error(
        `Error getting profession by name ${nameCN}: ${error.message}`,
      );
      return null;
    }
  }

  /** Get profession by name (tries both Chinese and English)
   * @param {string} name - Profession name in either Chinese or English
   * @returns {Object|null} - Profession data
   */
  getByName(name) {
    if (!name) return null;

    try {
      // Try Chinese lookup first
      let profession = this.statements.getProfessionByCN.get(name);

      // If not found, try English lookup
      if (!profession) {
        profession = this.statements.getProfessionByEN.get(name);
      }

      return profession || null;
    } catch (error) {
      this.logger.error(
        `Error getting profession by name ${name}: ${error.message}`,
      );
      return null;
    }
  }

  /** Add or update profession
   * @param {number} id - Profession ID
   * @param {string} name_cn - Chinese name
   * @param {string} name_en - English name
   * @param {string} icon - Icon filename
   * @param {string} role - Role (dps/tank/healer)
   * @returns {boolean} - Success status
   */
  saveProfession(id, name_cn, name_en, icon, role) {
    try {
      const professionId = parseInt(id);
      if (isNaN(professionId) || !name_cn) {
        this.logger.warn(
          `Cannot save profession: invalid id (${id}) or missing name_cn`,
        );
        return false;
      }

      this.statements.insertProfession.run(
        professionId,
        name_cn,
        name_en,
        icon,
        role,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error saving profession ${id}: ${error.message}`);
      return false;
    }
  }

  /** Get all professions
   * @returns {Array} - Array of all professions
   */
  getAllProfessions() {
    try {
      return this.statements.getAllProfessions.all();
    } catch (error) {
      this.logger.error(`Error getting all professions: ${error.message}`);
      return [];
    }
  }

  /** Load professions from JSON file and populate database
   * @param {string} jsonPath - Path to professions.json seed file
   */
  loadFromJSON(jsonPath) {
    try {
      // Check if already populated
      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM professions")
        .get();

      if (count.count > 0) {
        this.logger.debug(
          "Profession table already populated, skipping JSON load",
        );
        return;
      }

      // Read JSON file
      if (!fs.existsSync(jsonPath)) {
        this.logger.warn(`Profession seed file not found: ${jsonPath}`);
        return;
      }

      const data = fs.readFileSync(jsonPath, "utf8");
      const professionsData = JSON.parse(data);

      // Support professions array
      const professions = professionsData.professions || [];

      // Insert professions in a transaction
      const insertProfessions = this.db.transaction((profs) => {
        for (const prof of profs) {
          this.statements.insertProfession.run(
            prof.id,
            prof.name_cn,
            prof.name_en || null,
            prof.icon || null,
            prof.role || null,
          );
        }
      });

      insertProfessions(professions);

      const newCount = this.db
        .prepare("SELECT COUNT(*) as count FROM professions")
        .get();

      this.logger.info(`Loaded ${newCount.count} professions from JSON`);
    } catch (error) {
      this.logger.error(
        `Error loading professions from JSON: ${error.message}`,
      );
    }
  }
}

module.exports = ProfessionModel;
