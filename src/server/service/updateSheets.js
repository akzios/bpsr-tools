const https = require("https");
const path = require("path");
const fs = require("fs");
const GoogleSheetsService = require("./googleSheets");
const configPaths = require("../utilities/configPaths");

/**
 * Fetches player data from external API and updates Google Sheets
 * Only updates if GS is higher, appends if player not found
 * Format: UID, NAME, GS, CLASS, DISCORD
 */

// List of players to query (username,uid)
const PLAYER_LIST = [
  { username: "Lollercoaster", uid: "4526575" },
  { username: "Hesitant", uid: "2691173" },
  { username: "Emily2648", uid: "4727635" },
  { username: "Sekaijuu (Luna)", uid: "47533" },
  { username: "MuDDAFuQA", uid: "667952" },
  { username: "Soul", uid: "244715" },
  { username: "Kai (tKai)", uid: "2683" },
  { username: "JudgeGilman", uid: "3105102" },
  { username: "Ryeo", uid: "30880" },
  { username: "Rugiewit", uid: "59705" },
  { username: "茶茶 | Tea", uid: "5755748" },
  { username: "Yoso", uid: "850936" },
  { username: "Ruaa", uid: "16546" },
  { username: "梦梦 | Oreo (Oneiroi)", uid: "3703681" },
  { username: "Shadi", uid: "36047408" },
  { username: "白菜 | baechu", uid: "756451" },
  { username: "Niflheim", uid: "19681541" },
  { username: "Reith", uid: "2465852" },
  { username: "OnePiece", uid: "1436339" },
  { username: "ziGGs", uid: "112787" },
  { username: "Poopsy", uid: "1437751" },
  { username: "猪猪 | PEIQI", uid: "930709" },
  { username: "Tearless (Tear)", uid: "86231755" },
  { username: "Aeterna", uid: "70663098" },
  { username: "兔兔 | Lyra", uid: "19255473" },
  { username: "Winter", uid: "217777" },
  { username: "Depresso", uid: "49495" },
  { username: "Byohr", uid: "646115" },
  { username: "Valier", uid: "7177187" },
  { username: "Bun", uid: "838366" },
  { username: "Præy", uid: "34820399" },
  { username: "Cookiezi", uid: "1673363" },
  { username: "Stink Trap-Ren (ShurenDouji)", uid: "47516416" },
  { username: "Hot (Desire)", uid: "659602" },
  { username: "hazelnut", uid: "4105201" },
  { username: "viliton", uid: "4328117" },
  { username: "Rising", uid: "240453" },
  { username: "Clash", uid: "48744530" },
];

/**
 * Fetch player data from external API using native https module
 */
function fetchPlayerData(uid) {
  return new Promise((resolve, reject) => {
    const url = `https://bp-db.de/neu/api/players?q=${uid}`;

    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const json = JSON.parse(data);

            // New API returns { success: true, data: { players: [...], count: N, limit: N } }
            // Each player has: player_id, name, profession, fightPoint, max_hp
            const players = json?.data?.players;

            if (players && Array.isArray(players) && players.length > 0) {
              // Find exact match for the UID (API does partial matches)
              const player = players.find(
                (row) => String(row.player_id) === String(uid),
              );

              if (player) {
                resolve({
                  uid: String(player.player_id),
                  name: player.name || "Unknown",
                  profession: player.profession || "Unknown",
                  fightPoint: parseInt(player.fightPoint) || 0,
                });
              } else {
                console.error(`No exact match for UID ${uid}`);
                resolve(null);
              }
            } else {
              console.error(`No data returned for UID ${uid}`);
              resolve(null);
            }
          } catch (error) {
            console.error(`Error parsing JSON for UID ${uid}:`, error.message);
            resolve(null);
          }
        });
      })
      .on("error", (error) => {
        console.error(`Error fetching UID ${uid}:`, error.message);
        resolve(null);
      });
  });
}

/**
 * Main function to update Google Sheets with player data
 */
async function updateSheetsWithPlayers() {
  console.log("=== Starting Google Sheets Update ===\n");

  // Initialize Google Sheets service
  const logger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
    debug: (msg) => console.log(`[DEBUG] ${msg}`),
  };

  const sheetsService = new GoogleSheetsService(logger);
  const initialized = await sheetsService.initialize();

  if (!initialized) {
    console.error(
      "Failed to initialize Google Sheets service. Check sheets.json configuration.",
    );
    return;
  }

  // Load sheets config to get spreadsheet ID and sheet name
  const sheetsConfigPath = configPaths.getConfigPath("sheets.json");
  const sheetsConfig = JSON.parse(fs.readFileSync(sheetsConfigPath, "utf8"));
  const spreadsheetId = sheetsConfig.spreadsheetId;
  const sheetName = sheetsConfig.sheetName;

  console.log(`Target: Spreadsheet ID: ${spreadsheetId}`);
  console.log(`Target: Sheet Name: ${sheetName}\n`);

  // Fetch data for all players
  console.log(`Fetching data for ${PLAYER_LIST.length} players...\n`);
  const playerDataPromises = PLAYER_LIST.map(async (player) => {
    console.log(`Fetching ${player.username} (${player.uid})...`);
    return await fetchPlayerData(player.uid);
  });

  const results = await Promise.all(playerDataPromises);
  const validPlayers = results.filter((p) => p !== null);

  console.log(
    `\nFetched ${validPlayers.length}/${PLAYER_LIST.length} players successfully\n`,
  );

  if (validPlayers.length === 0) {
    console.error("No valid player data fetched. Aborting.");
    return;
  }

  // Update Google Sheets
  console.log("Updating Google Sheets...\n");
  const result = await sheetsService.updatePlayerData(
    spreadsheetId,
    sheetName,
    validPlayers,
  );

  if (result.success) {
    console.log("\n=== Update Complete ===");
    console.log(`New players added: ${result.new}`);
    console.log(`Existing players updated (GS increased): ${result.updated}`);
    console.log(`Total players in sheet: ${result.total}`);
  } else {
    console.error(`\nUpdate failed: ${result.error}`);
  }
}

// Run if executed directly
if (require.main === module) {
  updateSheetsWithPlayers().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { updateSheetsWithPlayers, fetchPlayerData };
