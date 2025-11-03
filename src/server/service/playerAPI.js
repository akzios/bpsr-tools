const https = require("https");

/**
 * Service for fetching player data from the Blue Protocol leaderboard API
 */
class PlayerAPIService {
  constructor(logger) {
    this.logger = {
      info: (msg) => logger.info(`[PlayerAPI] ${msg}`),
      error: (msg) => logger.error(`[PlayerAPI] ${msg}`),
      warn: (msg) => logger.warn(`[PlayerAPI] ${msg}`),
      debug: (msg) => logger.debug(`[PlayerAPI] ${msg}`),
    };

    // Track pending API fetches to avoid duplicate requests
    this.pendingFetches = new Set();

    // Cache API results for 5 minutes to avoid spamming the API
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch player data from API
   * @param {number} playerId - Player ID to fetch
   * @returns {Promise<Object|null>} Player data or null if not found
   */
  async fetchPlayerData(playerId) {
    // Check cache first
    const cached = this.cache.get(playerId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.debug(`Using cached data for player ${playerId}`);
      return cached.data;
    }

    // Check if already fetching
    if (this.pendingFetches.has(playerId)) {
      this.logger.debug(`Already fetching data for player ${playerId}`);
      return null;
    }

    this.pendingFetches.add(playerId);

    try {
      const url = `https://blueprotocol.lunixx.de/api/players?q=${playerId}`;

      this.logger.debug(`Fetching player data from API for ID ${playerId}`);

      const data = await new Promise((resolve, reject) => {
        https
          .get(url, (res) => {
            let responseData = "";

            res.on("data", (chunk) => {
              responseData += chunk;
            });

            res.on("end", () => {
              try {
                const parsed = JSON.parse(responseData);
                resolve(parsed);
              } catch (error) {
                reject(error);
              }
            });
          })
          .on("error", (error) => {
            reject(error);
          });
      });

      // New API format: { success: true, data: { players: [...], count: N, limit: N } }
      const players = data?.data?.players;

      if (players && Array.isArray(players) && players.length > 0) {
        // Find exact match for the player ID (API does partial matches)
        const playerData = players.find(
          (p) => String(p.player_id) === String(playerId)
        ) || players[0]; // Fall back to first result if no exact match

        // Cache the result
        this.cache.set(playerId, {
          data: playerData,
          timestamp: Date.now(),
        });

        this.logger.info(
          `Fetched player data from API: ${playerData.name} (ID: ${playerId}, FP: ${playerData.fightPoint})`,
        );

        return playerData;
      } else {
        this.logger.debug(`No API data found for player ${playerId}`);

        // Cache null result to avoid repeated failed lookups
        this.cache.set(playerId, {
          data: null,
          timestamp: Date.now(),
        });

        return null;
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch player data from API for ID ${playerId}: ${error.message}`,
      );
      return null;
    } finally {
      this.pendingFetches.delete(playerId);
    }
  }

  /**
   * Clear old cache entries
   */
  clearStaleCache() {
    const now = Date.now();
    for (const [playerId, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= this.CACHE_TTL) {
        this.cache.delete(playerId);
      }
    }
  }
}

module.exports = PlayerAPIService;
