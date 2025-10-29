const Database = require("better-sqlite3");
const path = require("path");
const { getDbPath } = require("../utilities/configPaths");

/**
 * TimeTrialModel
 * Manages time trial/parkour collectibles
 */
class TimeTrialModel {
  constructor() {
    const dbPath = path.join(getDbPath(), "bpsr-tools.db");
    this.db = new Database(dbPath);
    this.createTable();
  }

  /**
   * Create time_trials table if it doesn't exist
   */
  createTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS time_trials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collectible_id TEXT NOT NULL,
        map_id INTEGER NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(collectible_id, map_id, x, y, z)
      );

      CREATE INDEX IF NOT EXISTS idx_time_trials_map_id ON time_trials(map_id);
    `);

    console.log("[TimeTrialModel] Table created/verified");
  }

  /**
   * Import time trials from extracted JSON data
   * @param {Array} timeTrials - Array of time trial objects from JSON
   * @param {number} mapId - Map ID
   * @returns {Object} - Import statistics {imported, skipped}
   */
  importFromJson(timeTrials, mapId) {
    const stats = { imported: 0, skipped: 0 };

    if (!Array.isArray(timeTrials) || timeTrials.length === 0) {
      return stats;
    }

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO time_trials (collectible_id, map_id, x, y, z)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      timeTrials.forEach((trial) => {
        const result = insertStmt.run(
          trial.id,
          mapId,
          trial.x,
          trial.y,
          trial.z,
        );

        if (result.changes > 0) stats.imported++;
        else stats.skipped++;
      });
    });

    transaction();
    return stats;
  }

  /**
   * Get all time trials for a specific map
   * @param {number} mapId - Map ID
   * @returns {Array} - Array of time trial objects
   */
  getByMapId(mapId) {
    const stmt = this.db.prepare(`
      SELECT id, collectible_id as collectible_id, x, y, z
      FROM time_trials
      WHERE map_id = ?
      ORDER BY collectible_id
    `);

    return stmt.all(mapId);
  }

  /**
   * Get time trial count for a specific map
   * @param {number} mapId - Map ID
   * @returns {number} - Count of time trials
   */
  getCount(mapId) {
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM time_trials WHERE map_id = ?",
    );
    const result = stmt.get(mapId);
    return result.count;
  }

  /**
   * Get overall time trial statistics across all maps
   * @returns {Array} - Statistics per map
   */
  getOverallStatistics() {
    const stmt = this.db.prepare(`
      SELECT
        map_id,
        COUNT(*) as count
      FROM time_trials
      GROUP BY map_id
      ORDER BY map_id
    `);

    return stmt.all();
  }

  /**
   * Clear all time trials for a specific map
   * @param {number} mapId - Map ID
   * @returns {number} - Number of deleted rows
   */
  clearMap(mapId) {
    const stmt = this.db.prepare("DELETE FROM time_trials WHERE map_id = ?");
    const result = stmt.run(mapId);
    return result.changes;
  }

  /**
   * Clear all time trials
   * @returns {number} - Number of deleted rows
   */
  clearAll() {
    const stmt = this.db.prepare("DELETE FROM time_trials");
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

module.exports = TimeTrialModel;
