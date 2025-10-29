const CollectionTypeModel = require("../model/CollectionType");
const ChestModel = require("../model/Chest");
const StoryItemModel = require("../model/StoryItem");
const TimeTrialModel = require("../model/TimeTrial");
const PhotoLocationModel = require("../model/PhotoLocation");
const UserCollectionModel = require("../model/UserCollection");

/**
 * CollectionManager
 * Coordinates all collectible-related operations across multiple models
 */
class CollectionManager {
  constructor() {
    this.collectionTypes = new CollectionTypeModel();
    this.chests = new ChestModel();
    this.storyItems = new StoryItemModel();
    this.timeTrials = new TimeTrialModel();
    this.photoLocations = new PhotoLocationModel();
    this.userCollections = new UserCollectionModel();

    console.log("[CollectionManager] Initialized all collectible models");
  }

  /**
   * Import all collectibles from extracted JSON data
   * @param {Object} jsonData - Extracted map data with collectibles
   * @param {number} mapId - Map ID
   * @returns {Object} - Import statistics for all types
   */
  importAllFromJson(jsonData, mapId) {
    const stats = {
      chests: { imported: 0, skipped: 0 },
      storyItems: { imported: 0, skipped: 0 },
      timeTrials: { imported: 0, skipped: 0 },
      photoLocations: { imported: 0, skipped: 0 },
    };

    if (jsonData.chests) {
      stats.chests = this.chests.importFromJson(jsonData.chests, mapId);
    }

    if (jsonData.storyItems) {
      stats.storyItems = this.storyItems.importFromJson(
        jsonData.storyItems,
        mapId,
      );
    }

    if (jsonData.timeTrials) {
      stats.timeTrials = this.timeTrials.importFromJson(
        jsonData.timeTrials,
        mapId,
      );
    }

    if (jsonData.photoLocations) {
      stats.photoLocations = this.photoLocations.importFromJson(
        jsonData.photoLocations,
        mapId,
      );
    }

    console.log("[CollectionManager] Import complete for map", mapId, stats);
    return stats;
  }

  /**
   * Get all collectibles for a specific map
   * @param {number} mapId - Map ID
   * @returns {Object} - All collectibles grouped by type
   */
  getAllForMap(mapId) {
    return {
      chests: this.chests.getByMapId(mapId),
      storyItems: this.storyItems.getByMapId(mapId),
      timeTrials: this.timeTrials.getByMapId(mapId),
      photoLocations: this.photoLocations.getByMapId(mapId),
    };
  }

  /**
   * Get all collectibles for a specific map with user progress
   * @param {number} mapId - Map ID
   * @param {number} userId - User ID
   * @returns {Object} - All collectibles with collected status
   */
  getAllForMapWithProgress(mapId, userId) {
    const collectibles = this.getAllForMap(mapId);
    const collected = this.userCollections.getCollectedForMap(userId, mapId);

    // Mark each collectible as collected or not
    const markCollected = (items, collectedIds) => {
      return items.map((item) => ({
        ...item,
        collected: collectedIds.includes(item.id),
      }));
    };

    return {
      chests: markCollected(collectibles.chests, collected.chests),
      storyItems: markCollected(collectibles.storyItems, collected.storyItems),
      timeTrials: markCollected(collectibles.timeTrials, collected.timeTrials),
      photoLocations: markCollected(
        collectibles.photoLocations,
        collected.photoLocations,
      ),
    };
  }

  /**
   * Get collectible statistics for a specific map
   * @param {number} mapId - Map ID
   * @param {number} userId - Optional user ID for progress
   * @returns {Object} - Statistics for all collectible types
   */
  getStatistics(mapId, userId = null) {
    const stats = {
      chests: this.chests.getStatistics(mapId),
      storyItems: { total: this.storyItems.getCount(mapId) },
      timeTrials: { total: this.timeTrials.getCount(mapId) },
      photoLocations: this.photoLocations.getStatistics(mapId),
    };

    // Add user progress if userId provided
    if (userId) {
      const progress = this.userCollections.getProgress(userId, mapId);
      stats.progress = progress;
    }

    return stats;
  }

  /**
   * Get overall statistics across all maps
   * @param {number} userId - Optional user ID for progress
   * @returns {Object} - Overall statistics
   */
  getOverallStatistics(userId = null) {
    const stats = {
      chests: this.chests.getOverallStatistics(),
      storyItems: this.storyItems.getOverallStatistics(),
      timeTrials: this.timeTrials.getOverallStatistics(),
      photoLocations: this.photoLocations.getOverallStatistics(),
    };

    // Add user progress if userId provided
    if (userId) {
      const progress = this.userCollections.getOverallProgress(userId);
      stats.overallProgress = progress;
    }

    return stats;
  }

  /**
   * Mark a collectible as collected by a user
   * @param {number} userId - User ID
   * @param {string} collectionType - Collection type (chest, story_item, time_trial, photo_location)
   * @param {number} collectibleId - Collectible table ID
   * @param {number} mapId - Map ID
   * @returns {boolean} - Success status
   */
  markCollected(userId, collectionType, collectibleId, mapId) {
    return this.userCollections.markCollected(
      userId,
      collectionType,
      collectibleId,
      mapId,
    );
  }

  /**
   * Remove a collected item
   * @param {number} userId - User ID
   * @param {string} collectionType - Collection type
   * @param {number} collectibleId - Collectible table ID
   * @returns {boolean} - Success status
   */
  removeCollected(userId, collectionType, collectibleId) {
    return this.userCollections.removeCollected(
      userId,
      collectionType,
      collectibleId,
    );
  }

  /**
   * Clear all collectibles for a specific map
   * @param {number} mapId - Map ID
   * @returns {Object} - Number of deleted rows per type
   */
  clearMap(mapId) {
    return {
      chests: this.chests.clearMap(mapId),
      storyItems: this.storyItems.clearMap(mapId),
      timeTrials: this.timeTrials.clearMap(mapId),
      photoLocations: this.photoLocations.clearMap(mapId),
    };
  }

  /**
   * Clear all collectibles across all maps
   * @returns {Object} - Number of deleted rows per type
   */
  clearAll() {
    return {
      chests: this.chests.clearAll(),
      storyItems: this.storyItems.clearAll(),
      timeTrials: this.timeTrials.clearAll(),
      photoLocations: this.photoLocations.clearAll(),
    };
  }

  /**
   * Close all database connections
   */
  close() {
    this.chests.close();
    this.storyItems.close();
    this.timeTrials.close();
    this.photoLocations.close();
    this.userCollections.close();
  }
}

module.exports = CollectionManager;
