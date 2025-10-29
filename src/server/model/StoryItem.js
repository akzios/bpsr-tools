const Database = require("better-sqlite3");
const path = require("path");
const { getDbPath } = require("../utilities/configPaths");

/**
 * StoryItemModel
 * Manages story item collectibles (books, letters, notes, etc.)
 */
class StoryItemModel {
  constructor() {
    const dbPath = path.join(getDbPath(), "bpsr-tools.db");
    this.db = new Database(dbPath);
    this.createTable();
  }

  /**
   * Create story_items table if it doesn't exist
   */
  createTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS story_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collectible_id TEXT NOT NULL,
        map_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(collectible_id, map_id, x, y, z)
      );

      CREATE INDEX IF NOT EXISTS idx_story_items_map_id ON story_items(map_id);
      CREATE INDEX IF NOT EXISTS idx_story_items_name ON story_items(name);
    `);

    console.log("[StoryItemModel] Table created/verified");
  }

  /**
   * Import story items from extracted JSON data
   * @param {Array} storyItems - Array of story item objects from JSON
   * @param {number} mapId - Map ID
   * @returns {Object} - Import statistics {imported, skipped}
   */
  importFromJson(storyItems, mapId) {
    const stats = { imported: 0, skipped: 0 };

    if (!Array.isArray(storyItems) || storyItems.length === 0) {
      return stats;
    }

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO story_items (collectible_id, map_id, name, x, y, z)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      storyItems.forEach((item) => {
        const result = insertStmt.run(
          item.id,
          mapId,
          item.name,
          item.x,
          item.y,
          item.z,
        );

        if (result.changes > 0) stats.imported++;
        else stats.skipped++;
      });
    });

    transaction();
    return stats;
  }

  /**
   * Get all story items for a specific map
   * @param {number} mapId - Map ID
   * @returns {Array} - Array of story item objects
   */
  getByMapId(mapId) {
    const stmt = this.db.prepare(`
      SELECT id, collectible_id as collectible_id, name, x, y, z
      FROM story_items
      WHERE map_id = ?
      ORDER BY name
    `);

    return stmt.all(mapId);
  }

  /**
   * Search story items by name
   * @param {number} mapId - Map ID
   * @param {string} query - Search query
   * @returns {Array} - Array of matching story item objects
   */
  search(mapId, query) {
    const stmt = this.db.prepare(`
      SELECT id, collectible_id as collectible_id, name, x, y, z
      FROM story_items
      WHERE map_id = ? AND name LIKE ?
      ORDER BY name
    `);

    return stmt.all(mapId, `%${query}%`);
  }

  /**
   * Get story item count for a specific map
   * @param {number} mapId - Map ID
   * @returns {number} - Count of story items
   */
  getCount(mapId) {
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM story_items WHERE map_id = ?",
    );
    const result = stmt.get(mapId);
    return result.count;
  }

  /**
   * Get overall story item statistics across all maps
   * @returns {Array} - Statistics per map
   */
  getOverallStatistics() {
    const stmt = this.db.prepare(`
      SELECT
        map_id,
        COUNT(*) as count
      FROM story_items
      GROUP BY map_id
      ORDER BY map_id
    `);

    return stmt.all();
  }

  /**
   * Clear all story items for a specific map
   * @param {number} mapId - Map ID
   * @returns {number} - Number of deleted rows
   */
  clearMap(mapId) {
    const stmt = this.db.prepare("DELETE FROM story_items WHERE map_id = ?");
    const result = stmt.run(mapId);
    return result.changes;
  }

  /**
   * Clear all story items
   * @returns {number} - Number of deleted rows
   */
  clearAll() {
    const stmt = this.db.prepare("DELETE FROM story_items");
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

module.exports = StoryItemModel;
