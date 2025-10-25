const path = require("path");
const fs = require("fs");

class SkillModel {
  constructor(logger, db) {
    // Wrap logger with [SkillDB] prefix
    this.logger = {
      info: (msg) => logger.info(`[SkillDB] ${msg}`),
      error: (msg) => logger.error(`[SkillDB] ${msg}`),
      warn: (msg) => logger.warn(`[SkillDB] ${msg}`),
      debug: (msg) => logger.debug(`[SkillDB] ${msg}`),
    };
    this.db = db;
    this.statements = {}; // Cache prepared statements
  }

  /** Initialize skill table and prepare statements */
  initialize() {
    try {
      // Create table if not exists
      this.db.exec(`
                CREATE TABLE IF NOT EXISTS skills (
                    id INTEGER PRIMARY KEY,
                    name_cn TEXT NOT NULL,
                    name_en TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                );

                CREATE INDEX IF NOT EXISTS idx_skills_name_cn ON skills(name_cn);
                CREATE INDEX IF NOT EXISTS idx_skills_name_en ON skills(name_en);
            `);

      // Prepare statements
      this.statements.getSkill = this.db.prepare(
        "SELECT * FROM skills WHERE id = ?",
      );
      this.statements.insertSkill = this.db.prepare(`
                INSERT OR REPLACE INTO skills (id, name_cn, name_en)
                VALUES (?, ?, ?)
            `);
      this.statements.getAllSkills = this.db.prepare("SELECT * FROM skills");

      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM skills")
        .get();
      this.logger.info(`Skill table initialized: ${count.count} skills cached`);
    } catch (error) {
      this.logger.error(`Failed to initialize skill table: ${error.message}`);
      throw error;
    }
  }

  /** Load skills from JSON file and populate database
   * @param {string} jsonPath - Path to skills.json seed file
   */
  loadFromJSON(jsonPath) {
    try {
      // Check if already populated
      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM skills")
        .get();
      if (count.count > 0) {
        this.logger.debug("Skill table already populated, skipping JSON load");
        return;
      }

      // Read JSON file
      if (!fs.existsSync(jsonPath)) {
        this.logger.warn(`Skill names JSON not found: ${jsonPath}`);
        return;
      }

      const data = fs.readFileSync(jsonPath, "utf8");
      const skills = JSON.parse(data);

      // Insert all skills in a transaction for better performance
      const insert = this.db.transaction((skills) => {
        for (const [id, skillData] of Object.entries(skills)) {
          const skillId = parseInt(id);
          if (!isNaN(skillId)) {
            this.statements.insertSkill.run(
              skillId,
              skillData.name_cn,
              skillData.name_en,
            );
          } else {
            this.logger.warn(`Skipping invalid skill ID: ${id}`);
          }
        }
      });

      insert(skills);

      const newCount = this.db
        .prepare("SELECT COUNT(*) as count FROM skills")
        .get();
      this.logger.info(
        `Loaded ${newCount.count} skills from JSON into database`,
      );
    } catch (error) {
      this.logger.error(`Error loading skills from JSON: ${error.message}`);
    }
  }

  /** Get skill by ID
   * @param {string|number} skillId - Skill ID
   * @returns {Object|null} - Skill data with id, name_cn, name_en
   */
  getSkill(skillId) {
    try {
      const id = parseInt(skillId);
      if (isNaN(id)) {
        this.logger.warn(`Invalid skill ID: ${skillId}`);
        return null;
      }
      return this.statements.getSkill.get(id);
    } catch (error) {
      this.logger.error(`Error getting skill ${skillId}: ${error.message}`);
      return null;
    }
  }

  /** Get skill name (prefers English, falls back to Chinese)
   * @param {string|number} skillId - Skill ID
   * @returns {string|null} - Skill name or null
   */
  getSkillName(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill) return null;

    // Prefer English name if available, otherwise use Chinese
    return skill.name_en || skill.name_cn;
  }

  /** Add or update skill
   * @param {string|number} id - Skill ID
   * @param {string} name_cn - Chinese name
   * @param {string} name_en - English name (optional)
   * @returns {boolean} - Success status
   */
  saveSkill(id, name_cn, name_en = null) {
    try {
      const skillId = parseInt(id);
      if (isNaN(skillId) || !name_cn) {
        this.logger.warn(
          `Cannot save skill: invalid id (${id}) or missing name_cn`,
        );
        return false;
      }

      this.statements.insertSkill.run(skillId, name_cn, name_en);
      return true;
    } catch (error) {
      this.logger.error(`Error saving skill ${id}: ${error.message}`);
      return false;
    }
  }

  /** Get all skills
   * @returns {Array} - Array of all skills
   */
  getAllSkills() {
    try {
      return this.statements.getAllSkills.all();
    } catch (error) {
      this.logger.error(`Error getting all skills: ${error.message}`);
      return [];
    }
  }
}

module.exports = SkillModel;
