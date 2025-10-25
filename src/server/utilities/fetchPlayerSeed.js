const https = require("https");
const fs = require("fs");
const path = require("path");

// Profession mapping from professions.json
const professionMap = {
  Stormblade: 1,
  "Frost Mage": 2,
  "Wind Knight": 3,
  "Verdant Oracle": 4,
  "Heavy Guardian": 5,
  Marksman: 6,
  "Shield Knight": 7,
  "Soul Musician": 8,
};

function fetchPlayers() {
  return new Promise((resolve, reject) => {
    const url =
      "https://blueprotocol.lunixx.de/index.php?action=recent&limit=1000000";

    console.log("[FetchPlayerSeed] Fetching player data from API...");

    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.ok && json.recent) {
              console.log(
                `[FetchPlayerSeed] Fetched ${json.recent.length} players`,
              );
              resolve(json.recent);
            } else {
              reject(new Error("Invalid API response"));
            }
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

async function main(targetPath = null) {
  try {
    // Default path: project root for dev, but allow override for packaged apps
    const seedPath = targetPath || path.join(
      __dirname,
      "..",
      "..",
      "..",
      "db",
      "seed",
      "players.json",
    );

    // Ensure seed directory exists
    const seedDir = path.dirname(seedPath);
    if (!fs.existsSync(seedDir)) {
      fs.mkdirSync(seedDir, { recursive: true });
      console.log(`[FetchPlayerSeed] Created seed directory: ${seedDir}`);
    }

    // Load existing players if file exists
    let existingPlayers = [];
    if (fs.existsSync(seedPath)) {
      try {
        const existingData = JSON.parse(fs.readFileSync(seedPath, "utf8"));
        existingPlayers = existingData.players || [];
        console.log(
          `[FetchPlayerSeed] Loaded ${existingPlayers.length} existing players`,
        );
      } catch (error) {
        console.log(
          "[FetchPlayerSeed] Could not read existing players.json, starting fresh",
        );
      }
    } else {
      console.log(
        "[FetchPlayerSeed] No existing players.json found, starting fresh",
      );
    }

    // Fetch data from API
    const apiPlayers = await fetchPlayers();

    // Transform to seed format
    const newPlayers = apiPlayers.map((player) => {
      const professionId = professionMap[player.base_profession] || null;

      return {
        player_id: parseInt(player.player_id),
        name: player.name,
        profession_id: professionId,
        fight_point: parseInt(player.fightPoint) || 0,
        max_hp: parseInt(player.max_hp) || 0,
        player_level: null, // Not provided by API
      };
    });

    // Filter out invalid entries (missing required fields)
    const validNewPlayers = newPlayers.filter(
      (p) =>
        p.player_id &&
        p.name &&
        p.name !== "Unknown" &&
        p.profession_id &&
        p.fight_point > 0,
    );

    console.log(
      `[FetchPlayerSeed] Valid new players: ${validNewPlayers.length} / ${newPlayers.length}`,
    );

    // Merge with existing players - use Map to remove duplicates by player_id
    // New data overwrites old data for the same player_id
    const playerMap = new Map();

    // Add existing players first
    existingPlayers.forEach((player) => {
      playerMap.set(player.player_id, player);
    });

    // Add/overwrite with new players
    validNewPlayers.forEach((player) => {
      playerMap.set(player.player_id, player);
    });

    // Convert Map back to array
    const mergedPlayers = Array.from(playerMap.values());

    console.log(
      `[FetchPlayerSeed] Merged total: ${mergedPlayers.length} players`,
    );
    console.log(`[FetchPlayerSeed] - Existing: ${existingPlayers.length}`);
    console.log(`[FetchPlayerSeed] - New: ${validNewPlayers.length}`);
    console.log(
      `[FetchPlayerSeed] - Added: ${mergedPlayers.length - existingPlayers.length}`,
    );

    // Create seed data structure
    const seedData = {
      players: mergedPlayers,
    };

    // Save to seed file
    fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2), "utf8");

    console.log(
      `[FetchPlayerSeed] ✓ Saved ${mergedPlayers.length} players to ${seedPath}`,
    );
    console.log(
      `[FetchPlayerSeed] File size: ${(fs.statSync(seedPath).size / 1024 / 1024).toFixed(2)} MB`,
    );

    // Show profession distribution
    const professionCounts = {};
    mergedPlayers.forEach((p) => {
      professionCounts[p.profession_id] =
        (professionCounts[p.profession_id] || 0) + 1;
    });

    console.log("\n[FetchPlayerSeed] Profession distribution:");
    Object.keys(professionMap).forEach((profName) => {
      const id = professionMap[profName];
      const count = professionCounts[id] || 0;
      console.log(`  ${profName} (ID ${id}): ${count} players`);
    });
  } catch (error) {
    console.error("[FetchPlayerSeed] Error:", error.message);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = { main, fetchPlayers };

// Run if called directly
if (require.main === module) {
  main();
}
