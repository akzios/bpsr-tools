const path = require("path");
const fs = require("fs");
const configPaths = require("../utilities/configPaths");

/**
 * Seed all databases with initial data
 * This centralizes all seeding logic for players, monsters, skills, etc.
 */
class DatabaseSeeder {
  constructor(
    logger,
    playerModel,
    monsterModel,
    skillModel,
    professionModel,
    tagModel,
    monsterTagModel,
    db,
  ) {
    // Wrap logger with [DBSeed] prefix
    this.logger = {
      info: (msg) => logger.info(`[DBSeed] ${msg}`),
      error: (msg) => logger.error(`[DBSeed] ${msg}`),
      warn: (msg) => logger.warn(`[DBSeed] ${msg}`),
      debug: (msg) => logger.debug(`[DBSeed] ${msg}`),
    };
    this.models = {
      profession: professionModel,
      monster: monsterModel,
      skill: skillModel,
      player: playerModel,
      tag: tagModel,
      monsterTag: monsterTagModel,
    };
    this.db = db;
  }

  /**
   * Generic seed method to reduce code duplication
   * @param {string} type - Type of data to seed (profession, monster, skill, player)
   * @param {string} seedFile - JSON filename
   * @param {Function} getAllMethod - Method to get all records
   * @param {Function} loadMethod - Method to load from JSON
   * @returns {Object} - Result with success status and count
   */
  async seedType(type, seedFile, getAllMethod, loadMethod) {
    try {
      const seedPath = configPaths.getDbSeedPath(seedFile);

      if (!fs.existsSync(seedPath)) {
        return {
          success: false,
          message: `${type} seed file not found`,
          count: 0,
        };
      }

      const existingCount = getAllMethod().length;
      if (existingCount > 0) {
        return {
          success: true,
          message: `${type}s already seeded (${existingCount} ${type}s)`,
          count: existingCount,
          skipped: true,
        };
      }

      loadMethod(seedPath);
      const newCount = getAllMethod().length;
      this.logger.info(`Seeded ${newCount} ${type}s from JSON`);

      return {
        success: true,
        message: `Seeded ${newCount} ${type}s`,
        count: newCount,
      };
    } catch (error) {
      this.logger.error(`Error seeding ${type}s: ${error.message}`);
      return {
        success: false,
        message: `Failed to seed ${type}s: ${error.message}`,
        count: 0,
      };
    }
  }

  async seedProfessions() {
    return this.seedType(
      "Profession",
      "professions.json",
      () => this.models.profession.getAllProfessions(),
      (path) => this.models.profession.loadFromJSON(path),
    );
  }

  async seedMonsters() {
    return this.seedType(
      "Monster",
      "monsters.json",
      () => this.models.monster.getAllMonsters(),
      (path) => this.models.monster.loadFromJSON(path),
    );
  }

  async seedSkills() {
    return this.seedType(
      "Skill",
      "skills.json",
      () => this.models.skill.getAllSkills(),
      (path) => this.models.skill.loadFromJSON(path),
    );
  }

  async seedPlayers() {
    return this.seedType(
      "Player",
      "players.json",
      () => this.models.player.getAllPlayers(),
      (path) => this.models.player.loadFromJSON(path),
    );
  }

  async seedTags() {
    return this.seedType(
      "Tag",
      "tags.json",
      () => this.models.tag.getAllTags(),
      (path) => this.models.tag.loadFromJSON(path),
    );
  }

  async seedMonsterTags() {
    return this.seedType(
      "MonsterTag",
      "monster_tags.json",
      () => this.db.prepare("SELECT * FROM monster_tags").all(),
      (path) => this.models.monsterTag.loadFromJSON(path),
    );
  }

  /**
   * Seed all databases
   * @returns {Object} - Result with success status and message
   */
  async seedAll() {
    try {
      // Seed in order: tags and professions first (no dependencies)
      // Then monsters (depends on professions for validation)
      // Then monster_tags (depends on monsters and tags)
      // Then skills and players
      const phase1 = await Promise.all([
        this.seedTags(),
        this.seedProfessions(),
      ]);

      const phase2 = await Promise.all([
        this.seedMonsters(),
        this.seedSkills(),
        this.seedPlayers(),
      ]);

      const phase3 = await Promise.all([this.seedMonsterTags()]);

      const results = [...phase1, ...phase2, ...phase3];

      const totalSeeded = results.reduce((sum, r) => sum + (r.count || 0), 0);
      const allSuccess = results.every((r) => r.success);
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
   * Clear all seed data (for re-seeding)
   * WARNING: This will delete all seeded data
   */
  async clearAll() {
    try {
      const db = this.models.player.getDB();
      const tables = [
        "monster_tags",
        "players",
        "skills",
        "monsters",
        "tags",
        "professions",
      ];

      tables.forEach((table) => db.prepare(`DELETE FROM ${table}`).run());

      this.logger.info("Cleared all seed data");
      return { success: true, message: "All seed data cleared" };
    } catch (error) {
      this.logger.error(`Error clearing seed data: ${error.message}`);
      return {
        success: false,
        message: `Failed to clear seed data: ${error.message}`,
      };
    }
  }
}

// CLI interface - run this file directly to seed the database
if (require.main === module) {
  const { execSync } = require("child_process");

  const PATHS = {
    db: path.join(__dirname, "..", "..", "..", "db", "bpsr-tools.db"),
    fetchScript: path.join(
      __dirname,
      "..",
      "..",
      "..",
      "db",
      "scripts",
      "fetchPlayerSeed.js",
    ),
    collectibles: path.join(
      __dirname,
      "..",
      "..",
      "..",
      "db",
      "seed",
      "collectibles.json",
    ),
  };

  const createLogger = () => ({
    info: (msg) => console.log(`  ${msg}`),
    error: (msg) => console.error(`  ERROR: ${msg}`),
    warn: (msg) => console.warn(`  WARN: ${msg}`),
    debug: () => {},
  });

  const initializeModels = (logger) => {
    const PlayerModel = require("./Player");
    const MonsterModel = require("./Monster");
    const SkillModel = require("./Skill");
    const ProfessionModel = require("./Profession");
    const TagModel = require("./Tag");
    const MonsterTagModel = require("./MonsterTag");

    const playerModel = new PlayerModel(logger);
    playerModel.initialize();

    const db = playerModel.getDB();

    const monsterModel = new MonsterModel(logger, db);
    monsterModel.initialize();

    const skillModel = new SkillModel(logger, db);
    skillModel.initialize();

    const professionModel = new ProfessionModel(logger, db);
    professionModel.initialize();

    const tagModel = new TagModel(logger, db);
    tagModel.initialize();

    const monsterTagModel = new MonsterTagModel(logger, db);
    monsterTagModel.initialize();

    return {
      player: playerModel,
      monster: monsterModel,
      skill: skillModel,
      profession: professionModel,
      tag: tagModel,
      monsterTag: monsterTagModel,
      db,
    };
  };

  const fetchPlayerData = () => {
    console.log("Fetching latest player data...");
    try {
      execSync(`node "${PATHS.fetchScript}"`, { stdio: "inherit" });
      console.log("✓ Player data fetched\n");
    } catch (error) {
      console.error("✗ Failed to fetch player data:", error.message);
      console.log("  Continuing with existing player seed data...\n");
    }
  };

  const importCollectibles = (logger) => {
    console.log("\nImporting collectibles...");

    if (!fs.existsSync(PATHS.collectibles)) {
      console.log(
        "  ⚠ No collectibles.json found, skipping collectibles import",
      );
      return;
    }

    try {
      const CollectionManager = require("../service/collectionManager");
      const collectionManager = new CollectionManager();
      const combinedData = JSON.parse(
        fs.readFileSync(PATHS.collectibles, "utf-8"),
      );

      let totalCollectibles = 0;
      for (const mapData of combinedData.maps) {
        const stats = collectionManager.importAllFromJson(
          mapData,
          mapData.mapId,
        );
        const mapTotal =
          stats.chests.imported +
          stats.storyItems.imported +
          stats.timeTrials.imported +
          stats.photoLocations.imported;
        totalCollectibles += mapTotal;
        console.log(`  ${mapData.mapName}: ${mapTotal} collectibles`);
      }

      collectionManager.close();
      console.log(
        `  ✓ Imported ${totalCollectibles} collectibles from ${combinedData.maps.length} maps`,
      );
    } catch (error) {
      console.error(`  ✗ Failed to import collectibles: ${error.message}`);
    }
  };

  const displayStatistics = (db) => {
    console.log("\nDatabase Statistics:");

    const tables = [
      "professions",
      "monsters",
      "tags",
      "monster_tags",
      "skills",
      "players",
      "chests",
      "story_items",
      "time_trials",
      "photo_locations",
    ];

    const stats = {};
    tables.forEach((table) => {
      stats[table] = db
        .prepare(`SELECT COUNT(*) as count FROM ${table}`)
        .get().count;
    });

    const labels = {
      professions: "Professions",
      monsters: "Monsters",
      tags: "Tags",
      monster_tags: "Monster-Tag Links",
      skills: "Skills",
      players: "Players",
      chests: "Chests",
      story_items: "Story Items",
      time_trials: "Time Trials",
      photo_locations: "Photo Locations",
    };

    Object.entries(stats).forEach(([key, value]) => {
      console.log(`  ${labels[key].padEnd(18)} ${value}`);
    });
  };

  async function main() {
    console.log("=================================");
    console.log("Pre-Seed Database for Production");
    console.log("=================================\n");

    fetchPlayerData();

    console.log("Initializing database...");
    console.log(
      fs.existsSync(PATHS.db)
        ? "  Database found at: " +
            PATHS.db +
            "\n  Database will be cleared and re-seeded\n"
        : "  Database not found at: " +
            PATHS.db +
            "\n  Creating new database...\n",
    );

    const logger = createLogger();
    console.log("  Initializing database models...");

    const models = initializeModels(logger);
    console.log("  ✓ Models initialized\n");

    console.log("Clearing existing data...");
    const seeder = new DatabaseSeeder(
      logger,
      models.player,
      models.monster,
      models.skill,
      models.profession,
      models.tag,
      models.monsterTag,
      models.db,
    );

    await seeder.clearAll();
    console.log("  ✓ Database cleared\n");

    console.log("Seeding database...");
    const result = await seeder.seedAll();

    if (!result.success) {
      console.error(`\n✗ Failed: ${result.message}`);
      process.exit(1);
    }

    console.log(`\n✓ Success: ${result.message}`);

    importCollectibles(logger);
    displayStatistics(models.db);

    console.log("\n✓ Database is ready for production build");
    console.log("  Location:", PATHS.db);
    process.exit(0);
  }

  main().catch((err) => {
    console.error("\n✗ Fatal error during pre-seeding:", err.message);
    console.error(err.stack);
    process.exit(1);
  });
}
