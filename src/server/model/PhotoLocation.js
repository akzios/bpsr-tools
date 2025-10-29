const Database = require("better-sqlite3");
const path = require("path");
const { getDbPath } = require("../utilities/configPaths");

/**
 * PhotoLocationModel
 * Manages photo location collectibles (Camera Points, Scenic Viewpoints)
 */
class PhotoLocationModel {
  constructor() {
    const dbPath = path.join(getDbPath(), "bpsr-tools.db");
    this.db = new Database(dbPath);
    this.createTable();
  }

  /**
   * Create photo_locations table if it doesn't exist
   */
  createTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS photo_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collectible_id TEXT NOT NULL,
        map_id INTEGER NOT NULL,
        location_type TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(collectible_id, map_id, x, y, z)
      );

      CREATE INDEX IF NOT EXISTS idx_photo_locations_map_id ON photo_locations(map_id);
      CREATE INDEX IF NOT EXISTS idx_photo_locations_type ON photo_locations(location_type);
    `);

    console.log("[PhotoLocationModel] Table created/verified");
  }

  /**
   * Import photo locations from extracted JSON data
   * @param {Array} photoLocations - Array of photo location objects from JSON
   * @param {number} mapId - Map ID
   * @returns {Object} - Import statistics {imported, skipped}
   */
  importFromJson(photoLocations, mapId) {
    const stats = { imported: 0, skipped: 0 };

    if (!Array.isArray(photoLocations) || photoLocations.length === 0) {
      return stats;
    }

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO photo_locations (collectible_id, map_id, location_type, x, y, z)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      photoLocations.forEach((photo) => {
        const result = insertStmt.run(
          photo.id,
          mapId,
          photo.type,
          photo.x,
          photo.y,
          photo.z,
        );

        if (result.changes > 0) stats.imported++;
        else stats.skipped++;
      });
    });

    transaction();
    return stats;
  }

  /**
   * Get all photo locations for a specific map
   * @param {number} mapId - Map ID
   * @returns {Array} - Array of photo location objects
   */
  getByMapId(mapId) {
    const stmt = this.db.prepare(`
      SELECT id, collectible_id as collectible_id, location_type as type, x, y, z
      FROM photo_locations
      WHERE map_id = ?
      ORDER BY location_type, collectible_id
    `);

    return stmt.all(mapId);
  }

  /**
   * Get photo locations by type for a specific map
   * @param {number} mapId - Map ID
   * @param {string} locationType - Location type (Camera Point, Scenic Viewpoint)
   * @returns {Array} - Array of photo location objects
   */
  getByType(mapId, locationType) {
    const stmt = this.db.prepare(`
      SELECT id, collectible_id as collectible_id, location_type as type, x, y, z
      FROM photo_locations
      WHERE map_id = ? AND location_type = ?
      ORDER BY collectible_id
    `);

    return stmt.all(mapId, locationType);
  }

  /**
   * Get photo location statistics for a specific map
   * @param {number} mapId - Map ID
   * @returns {Object} - Statistics by type {Camera Point: count, Scenic Viewpoint: count}
   */
  getStatistics(mapId) {
    const stmt = this.db.prepare(`
      SELECT location_type, COUNT(*) as count
      FROM photo_locations
      WHERE map_id = ?
      GROUP BY location_type
    `);

    const rows = stmt.all(mapId);
    const stats = {};

    rows.forEach((row) => {
      stats[row.location_type] = row.count;
    });

    return stats;
  }

  /**
   * Get overall photo location statistics across all maps
   * @returns {Array} - Statistics per map
   */
  getOverallStatistics() {
    const stmt = this.db.prepare(`
      SELECT
        map_id,
        location_type,
        COUNT(*) as count
      FROM photo_locations
      GROUP BY map_id, location_type
      ORDER BY map_id, location_type
    `);

    return stmt.all();
  }

  /**
   * Clear all photo locations for a specific map
   * @param {number} mapId - Map ID
   * @returns {number} - Number of deleted rows
   */
  clearMap(mapId) {
    const stmt = this.db.prepare(
      "DELETE FROM photo_locations WHERE map_id = ?",
    );
    const result = stmt.run(mapId);
    return result.changes;
  }

  /**
   * Clear all photo locations
   * @returns {number} - Number of deleted rows
   */
  clearAll() {
    const stmt = this.db.prepare("DELETE FROM photo_locations");
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

module.exports = PhotoLocationModel;
