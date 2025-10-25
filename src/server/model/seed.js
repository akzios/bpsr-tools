const path = require("path");
const fs = require("fs");
const configPaths = require("../utilities/configPaths");

/**
 * Seed all databases with initial data
 * This centralizes all seeding logic for players, monsters, skills, etc.
 */
class DatabaseSeeder {
  constructor(logger, playerModel, monsterModel, skillModel, professionModel) {
    // Wrap logger with [DBSeed] prefix
    this.logger = {
      info: (msg) => logger.info(`[DBSeed] ${msg}`),
      error: (msg) => logger.error(`[DBSeed] ${msg}`),
      warn: (msg) => logger.warn(`[DBSeed] ${msg}`),
      debug: (msg) => logger.debug(`[DBSeed] ${msg}`),
    };
    this.playerModel = playerModel;
    this.monsterModel = monsterModel;
    this.skillModel = skillModel;
    this.professionModel = professionModel;
  }

  /**
   * Seed all databases
   * @returns {Object} - Result with success status and message
   */
  async seedAll() {
    try {
      const results = [];

      // Seed professions first (required for player FK)
      const professionResult = await this.seedProfessions();
      results.push(professionResult);

      // Seed monsters
      const monsterResult = await this.seedMonsters();
      results.push(monsterResult);

      // Seed skills
      const skillResult = await this.seedSkills();
      results.push(skillResult);

      // Seed players
      const playerResult = await this.seedPlayers();
      results.push(playerResult);

      // Aggregate results
      const totalSeeded = results.reduce((sum, r) => sum + (r.count || 0), 0);
      const allSuccess = results.every((r) => r.success);

      // Build detailed message
      const detailMessages = results
        .filter((r) => !r.skipped)
        .map((r) => r.message)
        .join(", ");

      return {
        success: allSuccess,
        message: allSuccess
          ? `Successfully seeded ${totalSeeded} records (${detailMessages})`
          : "Some seed operations failed",
        details: results,
      };
    } catch (error) {
      this.logger.error(`Error during database seeding: ${error.message}`);
      return {
        success: false,
        message: `Seeding failed: ${error.message}`,
      };
    }
  }

  /**
   * Seed monsters from JSON file
   * @returns {Object} - Result with success status and count
   */
  async seedMonsters() {
    try {
      const monsterSeedPath = configPaths.getDbSeedPath("monsters.json");

      // Check if seed file exists
      if (!fs.existsSync(monsterSeedPath)) {
        return {
          success: false,
          message: "Monster seed file not found",
          count: 0,
        };
      }

      // Check if already seeded
      const existingCount = this.monsterModel.getAllMonsters().length;
      if (existingCount > 0) {
        return {
          success: true,
          message: `Monsters already seeded (${existingCount} monsters)`,
          count: existingCount,
          skipped: true,
        };
      }

      // Load and seed
      this.monsterModel.loadFromJSON(monsterSeedPath);

      const newCount = this.monsterModel.getAllMonsters().length;
      this.logger.info(`Seeded ${newCount} monsters from JSON`);

      return {
        success: true,
        message: `Seeded ${newCount} monsters`,
        count: newCount,
      };
    } catch (error) {
      this.logger.error(`Error seeding monsters: ${error.message}`);
      return {
        success: false,
        message: `Failed to seed monsters: ${error.message}`,
        count: 0,
      };
    }
  }

  /**
   * Seed skills from JSON file
   * @returns {Object} - Result with success status and count
   */
  async seedSkills() {
    try {
      const skillSeedPath = configPaths.getDbSeedPath("skills.json");

      // Check if seed file exists
      if (!fs.existsSync(skillSeedPath)) {
        return {
          success: false,
          message: "Skill seed file not found",
          count: 0,
        };
      }

      // Check if already seeded
      const existingCount = this.skillModel.getAllSkills().length;
      if (existingCount > 0) {
        return {
          success: true,
          message: `Skills already seeded (${existingCount} skills)`,
          count: existingCount,
          skipped: true,
        };
      }

      // Load and seed
      this.skillModel.loadFromJSON(skillSeedPath);

      const newCount = this.skillModel.getAllSkills().length;
      this.logger.info(`Seeded ${newCount} skills from JSON`);

      return {
        success: true,
        message: `Seeded ${newCount} skills`,
        count: newCount,
      };
    } catch (error) {
      this.logger.error(`Error seeding skills: ${error.message}`);
      return {
        success: false,
        message: `Failed to seed skills: ${error.message}`,
        count: 0,
      };
    }
  }

  /**
   * Seed professions from JSON file
   * @returns {Object} - Result with success status and count
   */
  async seedProfessions() {
    try {
      const professionSeedPath = configPaths.getDbSeedPath("professions.json");

      // Check if seed file exists
      if (!fs.existsSync(professionSeedPath)) {
        return {
          success: false,
          message: "Profession seed file not found",
          count: 0,
        };
      }

      // Check if already seeded
      const existingCount = this.professionModel.getAllProfessions().length;

      if (existingCount > 0) {
        return {
          success: true,
          message: `Professions already seeded (${existingCount} professions)`,
          count: existingCount,
          skipped: true,
        };
      }

      // Load and seed
      this.professionModel.loadFromJSON(professionSeedPath);

      const newCount = this.professionModel.getAllProfessions().length;

      this.logger.info(`Seeded ${newCount} professions from JSON`);

      return {
        success: true,
        message: `Seeded ${newCount} professions`,
        count: newCount,
      };
    } catch (error) {
      this.logger.error(`Error seeding professions: ${error.message}`);
      return {
        success: false,
        message: `Failed to seed professions: ${error.message}`,
        count: 0,
      };
    }
  }

  /**
   * Seed players from JSON file
   * @returns {Object} - Result with success status and count
   */
  async seedPlayers() {
    try {
      const playerSeedPath = configPaths.getDbSeedPath("players.json");

      // Check if seed file exists
      if (!fs.existsSync(playerSeedPath)) {
        return {
          success: false,
          message: "Player seed file not found",
          count: 0,
        };
      }

      // Check if already seeded
      const existingCount = this.playerModel.getAllPlayers().length;
      if (existingCount > 0) {
        return {
          success: true,
          message: `Players already seeded (${existingCount} players)`,
          count: existingCount,
          skipped: true,
        };
      }

      // Load and seed
      this.playerModel.loadFromJSON(playerSeedPath);

      const newCount = this.playerModel.getAllPlayers().length;
      this.logger.info(`Seeded ${newCount} players from JSON`);

      return {
        success: true,
        message: `Seeded ${newCount} players`,
        count: newCount,
      };
    } catch (error) {
      this.logger.error(`Error seeding players: ${error.message}`);
      return {
        success: false,
        message: `Failed to seed players: ${error.message}`,
        count: 0,
      };
    }
  }

  /**
   * Clear all seed data (for re-seeding)
   * WARNING: This will delete all seeded data
   */
  async clearAll() {
    try {
      // Clear all tables
      const db = this.playerModel.getDB();
      db.prepare("DELETE FROM monsters").run();
      db.prepare("DELETE FROM skills").run();
      db.prepare("DELETE FROM professions").run();
      db.prepare("DELETE FROM players").run();

      this.logger.info("Cleared all seed data");
      return {
        success: true,
        message: "All seed data cleared",
      };
    } catch (error) {
      this.logger.error(`Error clearing seed data: ${error.message}`);
      return {
        success: false,
        message: `Failed to clear seed data: ${error.message}`,
      };
    }
  }
}

module.exports = DatabaseSeeder;
