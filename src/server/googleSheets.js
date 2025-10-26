const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const configPaths = require(path.join(__dirname, "utilities", "configPaths"));

class GoogleSheetsService {
  constructor(logger) {
    this.logger = logger;
    this.sheets = null;
    this.auth = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Use configPaths utility to get sheets.json from userData directory
      // This ensures updates won't overwrite user credentials
      const sheetsConfigPath = configPaths.getConfigPath("sheets.json");

      // Check if config file exists
      if (!fs.existsSync(sheetsConfigPath)) {
        this.logger.warn(
          "Google Sheets config not found. Sheets integration disabled.",
        );
        this.logger.warn(`Looked in: ${sheetsConfigPath}`);
        this.logger.warn(
          "To enable, configure sheets.json in the launcher settings.",
        );
        return false;
      }

      this.logger.info(
        `Loading Google Sheets config from: ${sheetsConfigPath}`,
      );

      // Load config and extract credentials
      const sheetsConfig = JSON.parse(
        fs.readFileSync(sheetsConfigPath, "utf8"),
      );
      const credentials = sheetsConfig.credentials;

      // Create auth client
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      // Initialize sheets API
      this.sheets = google.sheets({ version: "v4", auth: this.auth });
      this.initialized = true;

      this.logger.info("Google Sheets service initialized successfully");
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize Google Sheets: ${error.message}`);
      return false;
    }
  }

  /**
   * Update player data in Google Sheets intelligently
   * Format: UID, NAME, GS, CLASS, DISCORD
   * - Only updates rows where GS actually increased
   * - Only appends new players (not already in sheet)
   * - Does NOT touch existing rows with no changes
   * - Preserves Discord column data
   * @param {string} spreadsheetId - The Google Sheets spreadsheet ID
   * @param {string} sheetName - The sheet name (tab name)
   * @param {Array} playerData - Array of player objects with uid, name, fightPoint, profession
   */
  async updatePlayerData(spreadsheetId, sheetName, playerData) {
    if (!this.initialized) {
      this.logger.warn("Google Sheets not initialized. Skipping update.");
      return false;
    }

    try {
      const sheetId = this.extractSheetId(spreadsheetId);

      // Get existing data from sheet
      const existingData = await this.getSheetData(sheetId, `${sheetName}!A:E`);

      // Build map of existing players: UID -> {rowNumber, name, gs, class, discord}
      const existingPlayers = new Map();

      if (existingData && existingData.length > 1) {
        // Skip header row (index 0)
        for (let i = 1; i < existingData.length; i++) {
          const row = existingData[i];
          if (row[0]) {
            // Has UID - convert to string for consistent comparison
            const uid = String(row[0]);
            existingPlayers.set(uid, {
              rowNumber: i + 1, // Sheet rows are 1-indexed
              name: row[1] || "",
              gs: row[2] || "",
              class: row[3] || "",
              discord: row[4] || "",
            });
          }
        }
      }

      // Prepare batch updates for rows where GS increased
      const updateRequests = [];
      const actuallyUpdated = new Set();
      const newPlayers = [];

      for (const player of playerData) {
        // Ensure UID is string for consistent comparison
        const uid = String(player.uid);
        const existing = existingPlayers.get(uid);

        if (existing) {
          // Player exists - check if GS increased
          const newGS = player.fightPoint || 0;
          const existingGS = existing.gs ? parseInt(existing.gs) : 0;

          if (newGS > existingGS) {
            // GS increased - update this specific row only
            updateRequests.push({
              range: `${sheetName}!A${existing.rowNumber}:E${existing.rowNumber}`,
              values: [
                [
                  uid,
                  player.name || existing.name || "Unknown",
                  newGS,
                  player.profession || existing.class || "Unknown",
                  existing.discord || "", // Preserve Discord
                ],
              ],
            });
            actuallyUpdated.add(uid);
            this.logger.debug(
              `Updating row ${existing.rowNumber} for ${player.name} (${uid}): GS ${existingGS} → ${newGS}`,
            );
          }
          // If GS didn't increase, don't touch this row at all
        } else {
          // New player - add to append list
          if (
            player.name &&
            player.name !== "Unknown" &&
            player.fightPoint > 0 &&
            player.profession &&
            player.profession !== "Unknown"
          ) {
            newPlayers.push([
              uid,
              player.name,
              player.fightPoint,
              player.profession,
              "", // Empty Discord for new entries
            ]);
            this.logger.debug(
              `Adding new player ${player.name} (${uid}) with GS ${player.fightPoint}`,
            );
          }
        }
      }

      // Execute batch update for changed rows (if any)
      if (updateRequests.length > 0) {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          resource: {
            valueInputOption: "RAW",
            data: updateRequests,
          },
        });
        this.logger.info(
          `Updated ${updateRequests.length} rows with increased GS`,
        );
      }

      // Append new players (if any)
      if (newPlayers.length > 0) {
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: `${sheetName}!A:E`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: { values: newPlayers },
        });
        this.logger.info(`Appended ${newPlayers.length} new players`);
      }

      const totalRows = existingPlayers.size + newPlayers.length;

      this.logger.info(
        `Google Sheet "${sheetName}" sync complete. ${newPlayers.length} new, ${actuallyUpdated.size} updated (GS increased), ${totalRows} total players.`,
      );

      return {
        success: true,
        new: newPlayers.length,
        updated: actuallyUpdated.size,
        total: totalRows,
      };
    } catch (error) {
      this.logger.error(`Failed to update Google Sheets: ${error.message}`);
      if (error.code === 403) {
        this.logger.error(
          "Permission denied. Make sure the sheet is shared with the service account email.",
        );
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Append player data to Google Sheets (doesn't clear existing data)
   * @param {string} spreadsheetId - The Google Sheets spreadsheet ID
   * @param {string} sheetName - The sheet name
   * @param {Array} playerData - Array of player objects
   */
  async appendPlayerData(spreadsheetId, sheetName, playerData) {
    if (!this.initialized) {
      this.logger.warn("Google Sheets not initialized. Skipping append.");
      return false;
    }

    try {
      const sheetId = this.extractSheetId(spreadsheetId);

      // Format data for sheets: [UID, NAME, GS, CLASS, DISCORD]
      const rows = playerData.map((player) => [
        player.uid,
        player.name || "Unknown",
        player.fightPoint || 0,
        player.profession || "Unknown",
        "", // Empty Discord column for new entries
      ]);

      const range = `${sheetName}!A:E`;

      // Append the data
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: rows },
      });

      this.logger.info(
        `Successfully appended to Google Sheet "${sheetName}". ${response.data.updates.updatedRows} rows added.`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to append to Google Sheets: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract spreadsheet ID from URL or return as-is if already an ID
   */
  extractSheetId(input) {
    // If it's a URL, extract the ID
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      return match[1];
    }
    // Otherwise assume it's already an ID
    return input;
  }

  /**
   * Get current data from sheet
   */
  async getSheetData(spreadsheetId, range) {
    if (!this.initialized) {
      return null;
    }

    try {
      const sheetId = this.extractSheetId(spreadsheetId);
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
      });

      return response.data.values || [];
    } catch (error) {
      this.logger.error(`Failed to get sheet data: ${error.message}`);
      return null;
    }
  }
}

module.exports = GoogleSheetsService;
