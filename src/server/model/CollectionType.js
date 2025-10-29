const Database = require("better-sqlite3");
const path = require("path");
const { getDbPath } = require("../utilities/configPaths");

/**
 * CollectionTypeModel
 * Manages metadata and settings for collection types (chest, story_item, time_trial, photo_location)
 */
class CollectionTypeModel {
  constructor() {
    const dbPath = path.join(getDbPath(), "bpsr-tools.db");
    this.db = new Database(dbPath);
    this.createTable();
    this.seedData();
  }

  /**
   * Create collection_types table if it doesn't exist
   */
  createTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS collection_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        table_name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    console.log("[CollectionTypeModel] Table created/verified");
  }

  /**
   * Seed default collection types if table is empty
   */
  seedData() {
    const count = this.db
      .prepare("SELECT COUNT(*) as count FROM collection_types")
      .get();

    if (count.count === 0) {
      const insert = this.db.prepare(`
        INSERT INTO collection_types (type_name, display_name, table_name, icon, color, enabled)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const types = [
        ["chest", "Chest", "chests", "chest.png", "#FFD700", 1],
        ["story_item", "Story Item", "story_items", "book.png", "#4A90E2", 1],
        ["time_trial", "Time Trial", "time_trials", "timer.png", "#E74C3C", 1],
        [
          "photo_location",
          "Photo Location",
          "photo_locations",
          "camera.png",
          "#9B59B6",
          1,
        ],
      ];

      const transaction = this.db.transaction(() => {
        types.forEach((type) => insert.run(...type));
      });

      transaction();
      console.log("[CollectionTypeModel] Seeded 4 collection types");
    }
  }

  /**
   * Get all collection types
   * @returns {Array} - Array of collection type objects
   */
  getAll() {
    const stmt = this.db.prepare("SELECT * FROM collection_types ORDER BY id");
    return stmt.all();
  }

  /**
   * Get collection type by type_name
   * @param {string} typeName - Type name (chest, story_item, time_trial, photo_location)
   * @returns {Object|null} - Collection type object or null
   */
  getByName(typeName) {
    const stmt = this.db.prepare(
      "SELECT * FROM collection_types WHERE type_name = ?",
    );
    return stmt.get(typeName);
  }

  /**
   * Update collection type settings
   * @param {string} typeName - Type name
   * @param {Object} settings - Settings to update {icon, color, enabled}
   * @returns {boolean} - Success status
   */
  updateSettings(typeName, settings) {
    const updates = [];
    const values = [];

    if (settings.icon !== undefined) {
      updates.push("icon = ?");
      values.push(settings.icon);
    }

    if (settings.color !== undefined) {
      updates.push("color = ?");
      values.push(settings.color);
    }

    if (settings.enabled !== undefined) {
      updates.push("enabled = ?");
      values.push(settings.enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return false;
    }

    values.push(typeName);

    const stmt = this.db.prepare(`
      UPDATE collection_types
      SET ${updates.join(", ")}
      WHERE type_name = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * Toggle enabled status for a collection type
   * @param {string} typeName - Type name
   * @param {boolean} enabled - Enabled status
   * @returns {boolean} - Success status
   */
  setEnabled(typeName, enabled) {
    const stmt = this.db.prepare(
      "UPDATE collection_types SET enabled = ? WHERE type_name = ?",
    );
    const result = stmt.run(enabled ? 1 : 0, typeName);
    return result.changes > 0;
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = CollectionTypeModel;
