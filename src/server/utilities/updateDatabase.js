/**
 * Manual Database Update Utility
 *
 * Allows users to manually update their database with fresh seed data:
 * 1. Fetches latest player data from external API
 * 2. Reads all seed JSON files (professions, monsters, skills, players)
 * 3. Merges them into the live user database
 * 4. Deduplicates by ID using INSERT OR IGNORE
 */

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { main: fetchPlayerData } = require("./fetchPlayerSeed");

/**
 * Update the user database with fresh seed data
 * @param {string} userDbPath - Path to user's database file
 * @param {string} seedBasePath - Path to seed directory (for accessing seed files)
 * @returns {Promise<object>} - Statistics about the update
 */
async function updateDatabase(userDbPath, seedBasePath) {
  const stats = {
    success: false,
    professions: 0,
    monsters: 0,
    skills: 0,
    players: 0,
    errors: [],
  };

  try {
    console.log("[updateDatabase] Starting database update...");
    console.log("[updateDatabase] Seed base path:", seedBasePath);

    // Step 1: Fetch latest player data from API
    console.log("[updateDatabase] Step 1: Fetching latest player data...");
    try {
      // Pass the target path so fetchPlayerData writes to the correct location
      const playersSeedPath = path.join(seedBasePath, "players.json");
      await fetchPlayerData(playersSeedPath);
      console.log("[updateDatabase] ✓ Player data fetched successfully");
    } catch (error) {
      stats.errors.push(`Failed to fetch player data: ${error.message}`);
      console.error(
        "[updateDatabase] ⚠️  Failed to fetch player data:",
        error.message,
      );
      // Continue anyway - we can still update other tables
    }

    // Step 2: Open user database
    console.log("[updateDatabase] Step 2: Opening user database...");
    if (!fs.existsSync(userDbPath)) {
      throw new Error(`Database not found: ${userDbPath}`);
    }

    const db = new Database(userDbPath);
    console.log("[updateDatabase] ✓ Database opened");

    // Step 3: Read seed files
    console.log("[updateDatabase] Step 3: Reading seed files...");

    const professionsSeedPath = path.join(seedBasePath, "professions.json");
    const monstersSeedPath = path.join(seedBasePath, "monsters.json");
    const skillsSeedPath = path.join(seedBasePath, "skills.json");
    const playersSeedPath = path.join(seedBasePath, "players.json");

    // Begin transaction for performance
    db.exec("BEGIN TRANSACTION");

    try {
      // Merge professions
      if (fs.existsSync(professionsSeedPath)) {
        const professionsData = JSON.parse(
          fs.readFileSync(professionsSeedPath, "utf8"),
        );
        const insertProf = db.prepare(`
          INSERT OR IGNORE INTO professions (id, name_cn, name_en, icon, role)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const prof of professionsData.professions || []) {
          const result = insertProf.run(
            prof.id,
            prof.name_cn,
            prof.name_en,
            prof.icon,
            prof.role,
          );
          if (result.changes > 0) stats.professions++;
        }
        console.log(
          `[updateDatabase] ✓ Professions: ${stats.professions} new entries`,
        );
      }

      // Merge monsters
      if (fs.existsSync(monstersSeedPath)) {
        const monstersData = JSON.parse(
          fs.readFileSync(monstersSeedPath, "utf8"),
        );
        const insertMon = db.prepare(`
          INSERT OR IGNORE INTO monsters (id, name_cn, name_en)
          VALUES (?, ?, ?)
        `);

        for (const mon of monstersData.monsters || []) {
          const result = insertMon.run(mon.id, mon.name_cn, mon.name_en);
          if (result.changes > 0) stats.monsters++;
        }
        console.log(
          `[updateDatabase] ✓ Monsters: ${stats.monsters} new entries`,
        );
      }

      // Merge skills
      if (fs.existsSync(skillsSeedPath)) {
        const skillsData = JSON.parse(fs.readFileSync(skillsSeedPath, "utf8"));
        const insertSkill = db.prepare(`
          INSERT OR IGNORE INTO skills (id, name_cn, name_en)
          VALUES (?, ?, ?)
        `);

        for (const skill of skillsData.skills || []) {
          const result = insertSkill.run(skill.id, skill.name_cn, skill.name_en);
          if (result.changes > 0) stats.skills++;
        }
        console.log(`[updateDatabase] ✓ Skills: ${stats.skills} new entries`);
      }

      // Merge players
      if (fs.existsSync(playersSeedPath)) {
        const playersData = JSON.parse(
          fs.readFileSync(playersSeedPath, "utf8"),
        );
        const insertPlayer = db.prepare(`
          INSERT OR IGNORE INTO players (player_id, name, profession_id, fight_point, max_hp, player_level)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const player of playersData.players || []) {
          const result = insertPlayer.run(
            player.player_id,
            player.name,
            player.profession_id,
            player.fight_point,
            player.max_hp,
            player.player_level,
          );
          if (result.changes > 0) stats.players++;
        }
        console.log(`[updateDatabase] ✓ Players: ${stats.players} new entries`);
      }

      db.exec("COMMIT");
      console.log("[updateDatabase] ✓ Transaction committed");
      stats.success = true;
    } catch (err) {
      db.exec("ROLLBACK");
      stats.errors.push(`Database merge failed: ${err.message}`);
      console.error("[updateDatabase] ❌ Error during merge, rolled back:", err.message);
      throw err;
    } finally {
      db.close();
      console.log("[updateDatabase] ✓ Database closed");
    }

    console.log("[updateDatabase] ========================================");
    console.log("[updateDatabase] Database Update Complete!");
    console.log(`[updateDatabase] New Professions: ${stats.professions}`);
    console.log(`[updateDatabase] New Monsters: ${stats.monsters}`);
    console.log(`[updateDatabase] New Skills: ${stats.skills}`);
    console.log(`[updateDatabase] New Players: ${stats.players}`);
    console.log("[updateDatabase] ========================================");

    return stats;
  } catch (error) {
    stats.success = false;
    stats.errors.push(error.message);
    console.error("[updateDatabase] ❌ Failed to update database:", error.message);
    return stats;
  }
}

module.exports = { updateDatabase };
