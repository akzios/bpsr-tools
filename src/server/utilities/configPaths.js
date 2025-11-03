const fs = require("fs");
const path = require("path");

/**
 * Utility module for managing config file paths in Electron and Node.js
 *
 * In packaged apps, we can't write to the app.asar directory.
 * This module manages copying default configs to userData on first run
 * and provides paths to the writable config files.
 */

// Check if we're running in Electron context
// Use process.versions.electron instead of trying to require electron.app
// This works in both main process and forked child processes
const isElectron = !!(process.versions && process.versions.electron);
const isPackaged = !!(process.resourcesPath); // True when running from installed app

// Get the user data directory (writable location)
let userDataPath;
let userConfigPath;
let userDbPath;
let appPath;

if (isElectron) {
  // Try to get app from electron module
  let app = null;
  try {
    const electron = require("electron");
    app = electron.app;
  } catch (e) {
    // In child process, electron.app is undefined
    app = null;
  }

  if (app) {
    // Main Electron process - use electron.app
    userDataPath = app.getPath("userData");
    userConfigPath = path.join(userDataPath, "config");
    userDbPath = path.join(userDataPath, "db");
    appPath = app.getAppPath();
    console.log("[configPaths] Running in Electron context");
  } else if (isPackaged) {
    // Child process in packaged app - construct paths manually
    const os = require("os");
    const appName = "bpsr-tools";
    userDataPath = path.join(os.homedir(), "AppData", "Roaming", appName);
    userConfigPath = path.join(userDataPath, "config");
    userDbPath = path.join(userDataPath, "db");
    appPath = path.dirname(process.resourcesPath);
    console.log("[configPaths] Running in Electron context (child process)");
  } else {
    // Dev mode - use current working directory
    userDataPath = process.cwd();
    userConfigPath = path.join(userDataPath, "config");
    userDbPath = path.join(userDataPath, "db");
    appPath = process.cwd();
    console.log("[configPaths] Running in Electron dev mode");
  }

  console.log("[configPaths] User data path:", userDataPath);
  console.log("[configPaths] Config path:", userConfigPath);
  console.log("[configPaths] Database path:", userDbPath);
  console.log("[configPaths] App path:", appPath);
  console.log("[configPaths] Settings will be saved to:", path.join(userConfigPath, "settings.json"));
  console.log("[configPaths] Database will be saved to:", path.join(userDbPath, "bpsr-tools.db"));
} else {
  // In non-Electron context, use current working directory
  userDataPath = process.cwd();
  userConfigPath = path.join(userDataPath, "config");
  userDbPath = path.join(userDataPath, "db");
  appPath = process.cwd();
  console.log("[configPaths] Running in Node.js context (not Electron)");
  console.log("[configPaths] User data path:", userDataPath);
  console.log("[configPaths] Database path:", userDbPath);
}

/**
 * Ensure a directory exists, creating it if necessary
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy a file from source to destination if destination doesn't exist
 * @param {string} srcPath - Source file path
 * @param {string} destPath - Destination file path
 * @param {boolean} binary - Whether to copy as binary (default: false for text files)
 */
function copyIfNotExists(srcPath, destPath, binary = false) {
  if (!fs.existsSync(destPath)) {
    try {
      if (binary) {
        // Copy binary files (like databases) without encoding
        const content = fs.readFileSync(srcPath);
        fs.writeFileSync(destPath, content);
      } else {
        // Copy text files with UTF-8 encoding
        const content = fs.readFileSync(srcPath, "utf8");
        fs.writeFileSync(destPath, content, "utf8");
      }
      console.log(`Copied file: ${path.basename(destPath)}`);
      return true;
    } catch (error) {
      console.error(`Failed to copy ${srcPath} to ${destPath}:`, error);
      return false;
    }
  }
  return false;
}

/**
 * Initialize user config directory and copy defaults
 */
function initializeUserConfigs() {
  console.log("Initializing user configs...");
  console.log("User data path:", userDataPath);
  console.log("App path:", appPath);

  ensureDirectoryExists(userConfigPath);
  ensureDirectoryExists(userDbPath);

  // Handle database: Copy on first run, or merge seed data on updates
  // In packaged apps, extraResources are in process.resourcesPath
  let dbSrcPath;

  // Use process.resourcesPath to detect packaged apps (works in child processes too)
  if (process.resourcesPath) {
    dbSrcPath = path.join(process.resourcesPath, "db", "bpsr-tools.db");
  } else {
    dbSrcPath = path.join(appPath, "db", "bpsr-tools.db");
  }

  const dbDestPath = path.join(userDbPath, "bpsr-tools.db");

  if (fs.existsSync(dbSrcPath)) {
    // Validate that the source database has skills before proceeding
    try {
      const Database = require("better-sqlite3");
      const tempDb = new Database(dbSrcPath, { readonly: true });
      const skillCount = tempDb.prepare("SELECT COUNT(*) as count FROM skills").get();
      console.log(`[configPaths] Source database contains ${skillCount.count} skills`);
      tempDb.close();

      if (skillCount.count === 0) {
        console.warn("[configPaths] WARNING: Pre-seeded database has 0 skills! Did you run 'npm run preseed'?");
      }
    } catch (error) {
      console.error(`[configPaths] Failed to validate source database: ${error.message}`);
    }

    // First run: copy entire database
    if (!fs.existsSync(dbDestPath)) {
      if (copyIfNotExists(dbSrcPath, dbDestPath, true)) {
        // true = binary file
        console.log("[configPaths] Copied pre-seeded database to userData");
      }
    } else {
      // Subsequent runs: merge seed data from installation database
      console.log(
        "[configPaths] Database exists, merging seed data from update...",
      );
      mergeSeedData(dbSrcPath, dbDestPath, !!process.resourcesPath);
    }
  } else {
    console.log(
      "[configPaths] No pre-seeded database found. Looked in:",
      dbSrcPath,
    );
  }

  console.log("User config initialization complete");
}

/**
 * Get the path to a config file in userData
 */
function getConfigPath(filename) {
  return path.join(userConfigPath, filename);
}

/**
 * Get the path to the database directory in userData
 */
function getDbPath() {
  return userDbPath;
}

/**
 * Get the path to database seed files in userData
 */
function getDbSeedPath(filename) {
  return path.join(userDbPath, "seed", filename);
}

/**
 * Get the user data path
 */
function getUserDataPath() {
  return userDataPath;
}

/**
 * Merge seed data from source database to destination database
 * Only merges professions, monsters, and skills in production
 * In dev mode, also merges players for testing
 */
function mergeSeedData(srcDbPath, destDbPath, isPackaged = true) {
  try {
    const Database = require("better-sqlite3");

    console.log(
      `[configPaths] Merging seed data from ${path.basename(srcDbPath)}`,
    );

    // Open both databases
    const srcDb = new Database(srcDbPath, { readonly: true });
    const destDb = new Database(destDbPath);

    // Begin transaction for performance
    destDb.exec("BEGIN TRANSACTION");

    try {
      // Merge professions (INSERT OR IGNORE to avoid overwriting)
      const professions = srcDb.prepare("SELECT * FROM professions").all();
      const insertProf = destDb.prepare(`
        INSERT OR IGNORE INTO professions (id, name_cn, name_en, icon, role)
        VALUES (?, ?, ?, ?, ?)
      `);

      let newProfessions = 0;
      for (const prof of professions) {
        const result = insertProf.run(
          prof.id,
          prof.name_cn,
          prof.name_en,
          prof.icon,
          prof.role,
        );
        if (result.changes > 0) newProfessions++;
      }
      if (newProfessions > 0) {
        console.log(`[configPaths] Added ${newProfessions} new professions`);
      }

      // Merge monsters
      const monsters = srcDb.prepare("SELECT * FROM monsters").all();
      const insertMon = destDb.prepare(`
        INSERT OR IGNORE INTO monsters (id, name_cn, name_en, monster_type, score)
        VALUES (?, ?, ?, ?, ?)
      `);

      let newMonsters = 0;
      for (const mon of monsters) {
        const result = insertMon.run(
          mon.id,
          mon.name_cn,
          mon.name_en,
          mon.monster_type,
          mon.score || 0
        );
        if (result.changes > 0) newMonsters++;
      }
      if (newMonsters > 0) {
        console.log(`[configPaths] Added ${newMonsters} new monsters`);
      }

      // Merge skills
      const skills = srcDb.prepare("SELECT * FROM skills").all();
      console.log(`[configPaths] Source database has ${skills.length} skills`);

      const insertSkill = destDb.prepare(`
        INSERT OR IGNORE INTO skills (id, name_cn, name_en)
        VALUES (?, ?, ?)
      `);

      let newSkills = 0;
      for (const skill of skills) {
        const result = insertSkill.run(skill.id, skill.name_cn, skill.name_en);
        if (result.changes > 0) newSkills++;
      }

      const destSkillCount = destDb.prepare("SELECT COUNT(*) as count FROM skills").get();
      console.log(`[configPaths] Destination database now has ${destSkillCount.count} skills`);

      if (newSkills > 0) {
        console.log(`[configPaths] Added ${newSkills} new skills`);
      }

      // Merge players (dev mode only)
      if (!isPackaged) {
        console.log("[configPaths] Dev mode: Merging player data...");
        const players = srcDb.prepare("SELECT * FROM players").all();
        const insertPlayer = destDb.prepare(`
          INSERT OR IGNORE INTO players (player_id, name, profession_id, fight_point, max_hp, player_level)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        let newPlayers = 0;
        for (const player of players) {
          const result = insertPlayer.run(
            player.player_id,
            player.name,
            player.profession_id,
            player.fight_point,
            player.max_hp,
            player.player_level,
          );
          if (result.changes > 0) newPlayers++;
        }
        if (newPlayers > 0) {
          console.log(`[configPaths] Added ${newPlayers} new players`);
        }
      } else {
        console.log(
          "[configPaths] Production mode: Skipping player merge (preserves user data)",
        );
      }

      destDb.exec("COMMIT");
      console.log("[configPaths] Seed data merge complete");
    } catch (err) {
      destDb.exec("ROLLBACK");
      console.error(
        "[configPaths] Error during merge, rolled back:",
        err.message,
      );
    } finally {
      srcDb.close();
      destDb.close();
    }
  } catch (error) {
    console.error("[configPaths] Failed to merge seed data:", error.message);
  }
}

module.exports = {
  initializeUserConfigs,
  getConfigPath,
  getDbPath,
  getDbSeedPath,
  getUserDataPath,
};
