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
let isElectron = false;
let app = null;

try {
  // Try to load electron - will fail in non-Electron environments
  const electron = require("electron");
  app = electron.app;
  isElectron = true;
} catch (e) {
  // Not in Electron context, that's fine
  isElectron = false;
}

// Get the user data directory (writable location)
let userDataPath;
let userConfigPath;
let userDbPath;
let appPath;

if (isElectron && app) {
  userDataPath = app.getPath("userData");
  userConfigPath = path.join(userDataPath, "config");
  userDbPath = path.join(userDataPath, "db");
  appPath = app.getAppPath();
  console.log("[configPaths] Running in Electron context");
  console.log("[configPaths] User data path:", userDataPath);
  console.log("[configPaths] Database path:", userDbPath);
  console.log("[configPaths] App path:", appPath);
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

  // Ensure config directory exists
  ensureDirectoryExists(userConfigPath);

  // Ensure db directory exists
  ensureDirectoryExists(userDbPath);

  // List of config files to copy from app to userData
  const configFiles = ["settings.json", "dictionary.json"];

  // Copy default configs if they don't exist
  for (const configFile of configFiles) {
    const srcPath = path.join(appPath, "config", configFile);
    const destPath = path.join(userConfigPath, configFile);

    if (fs.existsSync(srcPath)) {
      copyIfNotExists(srcPath, destPath);
    } else {
      console.warn(`Default config not found: ${srcPath}`);
    }
  }

  // Handle database: Copy on first run, or merge seed data on updates
  // In packaged apps, extraResources are in process.resourcesPath
  let dbSrcPath;
  if (isElectron && app && app.isPackaged) {
    dbSrcPath = path.join(process.resourcesPath, "db", "bpsr-tools.db");
  } else {
    dbSrcPath = path.join(appPath, "db", "bpsr-tools.db");
  }

  const dbDestPath = path.join(userDbPath, "bpsr-tools.db");

  if (fs.existsSync(dbSrcPath)) {
    // First run: copy entire database
    if (!fs.existsSync(dbDestPath)) {
      if (copyIfNotExists(dbSrcPath, dbDestPath, true)) { // true = binary file
        console.log("[configPaths] Copied pre-seeded database to userData");
      }
    } else {
      // Subsequent runs: merge seed data from installation database
      console.log("[configPaths] Database exists, merging seed data from update...");
      mergeSeedData(dbSrcPath, dbDestPath);
    }
  } else {
    console.log("[configPaths] No pre-seeded database found. Looked in:", dbSrcPath);
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
 * Only merges professions, monsters, and skills (not user data like players)
 */
function mergeSeedData(srcDbPath, destDbPath) {
  try {
    const Database = require('better-sqlite3');

    console.log(`[configPaths] Merging seed data from ${path.basename(srcDbPath)}`);

    // Open both databases
    const srcDb = new Database(srcDbPath, { readonly: true });
    const destDb = new Database(destDbPath);

    // Begin transaction for performance
    destDb.exec('BEGIN TRANSACTION');

    try {
      // Merge professions (INSERT OR IGNORE to avoid overwriting)
      const professions = srcDb.prepare('SELECT * FROM professions').all();
      const insertProf = destDb.prepare(`
        INSERT OR IGNORE INTO professions (id, name_cn, name_en, icon, role)
        VALUES (?, ?, ?, ?, ?)
      `);

      let newProfessions = 0;
      for (const prof of professions) {
        const result = insertProf.run(prof.id, prof.name_cn, prof.name_en, prof.icon, prof.role);
        if (result.changes > 0) newProfessions++;
      }
      if (newProfessions > 0) {
        console.log(`[configPaths] Added ${newProfessions} new professions`);
      }

      // Merge monsters
      const monsters = srcDb.prepare('SELECT * FROM monsters').all();
      const insertMon = destDb.prepare(`
        INSERT OR IGNORE INTO monsters (id, name_cn, name_en)
        VALUES (?, ?, ?)
      `);

      let newMonsters = 0;
      for (const mon of monsters) {
        const result = insertMon.run(mon.id, mon.name_cn, mon.name_en);
        if (result.changes > 0) newMonsters++;
      }
      if (newMonsters > 0) {
        console.log(`[configPaths] Added ${newMonsters} new monsters`);
      }

      // Merge skills
      const skills = srcDb.prepare('SELECT * FROM skills').all();
      const insertSkill = destDb.prepare(`
        INSERT OR IGNORE INTO skills (id, name_cn, name_en)
        VALUES (?, ?, ?)
      `);

      let newSkills = 0;
      for (const skill of skills) {
        const result = insertSkill.run(skill.id, skill.name_cn, skill.name_en);
        if (result.changes > 0) newSkills++;
      }
      if (newSkills > 0) {
        console.log(`[configPaths] Added ${newSkills} new skills`);
      }

      destDb.exec('COMMIT');
      console.log('[configPaths] Seed data merge complete');

    } catch (err) {
      destDb.exec('ROLLBACK');
      console.error('[configPaths] Error during merge, rolled back:', err.message);
    } finally {
      srcDb.close();
      destDb.close();
    }

  } catch (error) {
    console.error('[configPaths] Failed to merge seed data:', error.message);
  }
}

module.exports = {
  initializeUserConfigs,
  getConfigPath,
  getDbPath,
  getDbSeedPath,
  getUserDataPath,
};
