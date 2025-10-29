const Database = require("better-sqlite3");
const path = require("path");
const { getDbPath } = require("../utilities/configPaths");

/**
 * ChestModel
 * Manages chest collectibles (Common, Exquisite, Luxurious)
 */
class ChestModel {
  constructor() {
    const dbPath = path.join(getDbPath(), "bpsr-tools.db");
    this.db = new Database(dbPath);
    this.createTable();
  }

  /**
   * Create chests table if it doesn't exist
   */
  createTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collectible_id TEXT NOT NULL,
        map_id INTEGER NOT NULL,
        rarity TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(collectible_id, map_id, x, y, z)
      );

      CREATE INDEX IF NOT EXISTS idx_chests_map_id ON chests(map_id);
      CREATE INDEX IF NOT EXISTS idx_chests_rarity ON chests(rarity);
    `);

    console.log("[ChestModel] Table created/verified");
  }

  /**
   * Import chests from extracted JSON data
   * @param {Array} chests - Array of chest objects from JSON
   * @param {number} mapId - Map ID
   * @returns {Object} - Import statistics {imported, skipped}
   */
  importFromJson(chests, mapId) {
    const stats = { imported: 0, skipped: 0 };

    if (!Array.isArray(chests) || chests.length === 0) {
      return stats;
    }

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO chests (collectible_id, map_id, rarity, x, y, z)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      chests.forEach((chest) => {
        const result = insertStmt.run(
          chest.id,
          mapId,
          chest.type,
          chest.x,
          chest.y,
          chest.z,
        );

        if (result.changes > 0) stats.imported++;
        else stats.skipped++;
      });
    });

    transaction();
    return stats;
  }

  /**
   * Get all chests for a specific map
   * @param {number} mapId - Map ID
   * @returns {Array} - Array of chest objects
   */
  getByMapId(mapId) {
    const stmt = this.db.prepare(`
      SELECT id, collectible_id as collectible_id, rarity as type, x, y, z
      FROM chests
      WHERE map_id = ?
      ORDER BY rarity, collectible_id
    `);

    return stmt.all(mapId);
  }

  /**
   * Get chests by rarity for a specific map
   * @param {number} mapId - Map ID
   * @param {string} rarity - Chest rarity (Common, Exquisite, Luxurious, Unknown)
   * @returns {Array} - Array of chest objects
   */
  getByRarity(mapId, rarity) {
    const stmt = this.db.prepare(`
      SELECT id, collectible_id as collectible_id, rarity as type, x, y, z
      FROM chests
      WHERE map_id = ? AND rarity = ?
      ORDER BY collectible_id
    `);

    return stmt.all(mapId, rarity);
  }

  /**
   * Get chest statistics for a specific map
   * @param {number} mapId - Map ID
   * @returns {Object} - Statistics by rarity {Common: count, Exquisite: count, ...}
   */
  getStatistics(mapId) {
    const stmt = this.db.prepare(`
      SELECT rarity, COUNT(*) as count
      FROM chests
      WHERE map_id = ?
      GROUP BY rarity
    `);

    const rows = stmt.all(mapId);
    const stats = {};

    rows.forEach((row) => {
      stats[row.rarity] = row.count;
    });

    return stats;
  }

  /**
   * Get overall chest statistics across all maps
   * @returns {Object} - Overall statistics
   */
  getOverallStatistics() {
    const stmt = this.db.prepare(`
      SELECT
        map_id,
        rarity,
        COUNT(*) as count
      FROM chests
      GROUP BY map_id, rarity
      ORDER BY map_id, rarity
    `);

    return stmt.all();
  }

  /**
   * Clear all chests for a specific map
   * @param {number} mapId - Map ID
   * @returns {number} - Number of deleted rows
   */
  clearMap(mapId) {
    const stmt = this.db.prepare("DELETE FROM chests WHERE map_id = ?");
    const result = stmt.run(mapId);
    return result.changes;
  }

  /**
   * Clear all chests
   * @returns {number} - Number of deleted rows
   */
  clearAll() {
    const stmt = this.db.prepare("DELETE FROM chests");
    const result = stmt.run();
    return result.changes;
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = ChestModel;
