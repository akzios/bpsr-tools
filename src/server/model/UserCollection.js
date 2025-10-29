const Database = require("better-sqlite3");
const path = require("path");
const { getDbPath } = require("../utilities/configPaths");

/**
 * UserCollectionModel
 * Manages user collection progress tracking
 */
class UserCollectionModel {
  constructor() {
    const dbPath = path.join(getDbPath(), "bpsr-tools.db");
    this.db = new Database(dbPath);
    this.createTable();
  }

  /**
   * Create user_collections table if it doesn't exist
   */
  createTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        collection_type TEXT NOT NULL,
        collectible_table_id INTEGER NOT NULL,
        map_id INTEGER NOT NULL,
        collected_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, collection_type, collectible_table_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_collections_user ON user_collections(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_collections_map ON user_collections(user_id, map_id);
      CREATE INDEX IF NOT EXISTS idx_user_collections_type ON user_collections(user_id, collection_type);
    `);

    console.log("[UserCollectionModel] Table created/verified");
  }

  /**
   * Mark a collectible as collected
   * @param {number} userId - User ID
   * @param {string} collectionType - Collection type (chest, story_item, time_trial, photo_location)
   * @param {number} collectibleId - Collectible table ID
   * @param {number} mapId - Map ID
   * @returns {boolean} - Success status
   */
  markCollected(userId, collectionType, collectibleId, mapId) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO user_collections (user_id, collection_type, collectible_table_id, map_id)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(userId, collectionType, collectibleId, mapId);
    return result.changes > 0;
  }

  /**
   * Check if a collectible is collected by a user
   * @param {number} userId - User ID
   * @param {string} collectionType - Collection type
   * @param {number} collectibleId - Collectible table ID
   * @returns {boolean} - True if collected
   */
  isCollected(userId, collectionType, collectibleId) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM user_collections
      WHERE user_id = ? AND collection_type = ? AND collectible_table_id = ?
    `);

    const result = stmt.get(userId, collectionType, collectibleId);
    return result.count > 0;
  }

  /**
   * Get all collected items for a user on a specific map
   * @param {number} userId - User ID
   * @param {number} mapId - Map ID
   * @returns {Object} - Collected items grouped by type
   */
  getCollectedForMap(userId, mapId) {
    const stmt = this.db.prepare(`
      SELECT collection_type, collectible_table_id
      FROM user_collections
      WHERE user_id = ? AND map_id = ?
      ORDER BY collection_type, collectible_table_id
    `);

    const rows = stmt.all(userId, mapId);

    // Group by type
    const collected = {
      chests: [],
      storyItems: [],
      timeTrials: [],
      photoLocations: [],
    };

    rows.forEach((row) => {
      switch (row.collection_type) {
        case "chest":
          collected.chests.push(row.collectible_table_id);
          break;
        case "story_item":
          collected.storyItems.push(row.collectible_table_id);
          break;
        case "time_trial":
          collected.timeTrials.push(row.collectible_table_id);
          break;
        case "photo_location":
          collected.photoLocations.push(row.collectible_table_id);
          break;
      }
    });

    return collected;
  }

  /**
   * Get collection progress for a user on a specific map
   * @param {number} userId - User ID
   * @param {number} mapId - Map ID
   * @returns {Object} - Progress statistics per type
   */
  getProgress(userId, mapId) {
    // Get total counts per type for this map
    const totalStmt = this.db.prepare(`
      SELECT
        'chest' as type, COUNT(*) as total FROM chests WHERE map_id = ?
      UNION ALL SELECT 'story_item' as type, COUNT(*) as total FROM story_items WHERE map_id = ?
      UNION ALL SELECT 'time_trial' as type, COUNT(*) as total FROM time_trials WHERE map_id = ?
      UNION ALL SELECT 'photo_location' as type, COUNT(*) as total FROM photo_locations WHERE map_id = ?
    `);

    const totalRows = totalStmt.all(mapId, mapId, mapId, mapId);

    // Get collected counts per type for this user/map
    const collectedStmt = this.db.prepare(`
      SELECT collection_type, COUNT(*) as collected
      FROM user_collections
      WHERE user_id = ? AND map_id = ?
      GROUP BY collection_type
    `);

    const collectedRows = collectedStmt.all(userId, mapId);

    // Build progress object
    const progress = {
      chests: { collected: 0, total: 0, percentage: 0 },
      storyItems: { collected: 0, total: 0, percentage: 0 },
      timeTrials: { collected: 0, total: 0, percentage: 0 },
      photoLocations: { collected: 0, total: 0, percentage: 0 },
    };

    // Fill totals
    totalRows.forEach((row) => {
      const key =
        row.type === "chest"
          ? "chests"
          : row.type === "story_item"
            ? "storyItems"
            : row.type === "time_trial"
              ? "timeTrials"
              : "photoLocations";
      progress[key].total = row.total;
    });

    // Fill collected counts
    collectedRows.forEach((row) => {
      const key =
        row.collection_type === "chest"
          ? "chests"
          : row.collection_type === "story_item"
            ? "storyItems"
            : row.collection_type === "time_trial"
              ? "timeTrials"
              : "photoLocations";
      progress[key].collected = row.collected;
    });

    // Calculate percentages
    Object.keys(progress).forEach((key) => {
      if (progress[key].total > 0) {
        progress[key].percentage = Math.round(
          (progress[key].collected / progress[key].total) * 100,
        );
      }
    });

    return progress;
  }

  /**
   * Get overall collection progress for a user across all maps
   * @param {number} userId - User ID
   * @returns {Object} - Overall progress statistics
   */
  getOverallProgress(userId) {
    // Get total collectibles across all maps
    const totalStmt = this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM chests) +
        (SELECT COUNT(*) FROM story_items) +
        (SELECT COUNT(*) FROM time_trials) +
        (SELECT COUNT(*) FROM photo_locations) as total
    `);

    const totalResult = totalStmt.get();

    // Get total collected by user
    const collectedStmt = this.db.prepare(`
      SELECT COUNT(*) as collected
      FROM user_collections
      WHERE user_id = ?
    `);

    const collectedResult = collectedStmt.get(userId);

    const totalCollected = collectedResult.collected;
    const totalAvailable = totalResult.total;
    const percentage =
      totalAvailable > 0
        ? Math.round((totalCollected / totalAvailable) * 100)
        : 0;

    return {
      totalCollected,
      totalAvailable,
      percentage,
    };
  }

  /**
   * Remove a collected item
   * @param {number} userId - User ID
   * @param {string} collectionType - Collection type
   * @param {number} collectibleId - Collectible table ID
   * @returns {boolean} - Success status
   */
  removeCollected(userId, collectionType, collectibleId) {
    const stmt = this.db.prepare(`
      DELETE FROM user_collections
      WHERE user_id = ? AND collection_type = ? AND collectible_table_id = ?
    `);

    const result = stmt.run(userId, collectionType, collectibleId);
    return result.changes > 0;
  }

  /**
   * Clear all collection progress for a user
   * @param {number} userId - User ID
   * @returns {number} - Number of deleted rows
   */
  clearUserProgress(userId) {
    const stmt = this.db.prepare(
      "DELETE FROM user_collections WHERE user_id = ?",
    );
    const result = stmt.run(userId);
    return result.changes;
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = UserCollectionModel;
