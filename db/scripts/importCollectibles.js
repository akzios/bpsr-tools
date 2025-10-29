const fs = require("fs");
const path = require("path");
const CollectionManager = require("../../src/server/service/collectionManager");

/**
 * Import all collectibles from the combined collectibles.json file into the database
 * Usage: node db/scripts/importCollectibles.js
 */

async function importAllMaps() {
  const collectiblesPath = path.join(__dirname, "../seed/collectibles.json");
  const collectionManager = new CollectionManager();

  console.log("=== Starting Collectibles Import ===\n");

  // Check if collectibles.json exists
  if (!fs.existsSync(collectiblesPath)) {
    console.error(`Error: collectibles.json not found at ${collectiblesPath}`);
    console.log(
      "Please run the combine script to generate db/seed/collectibles.json first",
    );
    process.exit(1);
  }

  // Read combined collectibles file
  const combinedData = JSON.parse(fs.readFileSync(collectiblesPath, "utf-8"));

  console.log(`Found ${combinedData.maps.length} maps in collectibles.json`);
  console.log(`File generated at: ${combinedData.generatedAt}\n`);

  let totalStats = {
    mapsProcessed: 0,
    totalChests: 0,
    totalStoryItems: 0,
    totalTimeTrials: 0,
    totalPhotoLocations: 0,
  };

  // Process each map
  for (const mapData of combinedData.maps) {
    const { mapId, mapName } = mapData;

    console.log(`\n--- Importing ${mapName} (ID: ${mapId}) ---`);

    const stats = collectionManager.importAllFromJson(mapData, mapId);

    // Display results
    console.log(
      `  Chests: ${stats.chests.imported} imported, ${stats.chests.skipped} skipped`,
    );
    console.log(
      `  Story Items: ${stats.storyItems.imported} imported, ${stats.storyItems.skipped} skipped`,
    );
    console.log(
      `  Time Trials: ${stats.timeTrials.imported} imported, ${stats.timeTrials.skipped} skipped`,
    );
    console.log(
      `  Photo Locations: ${stats.photoLocations.imported} imported, ${stats.photoLocations.skipped} skipped`,
    );

    // Update totals
    totalStats.mapsProcessed++;
    totalStats.totalChests += stats.chests.imported;
    totalStats.totalStoryItems += stats.storyItems.imported;
    totalStats.totalTimeTrials += stats.timeTrials.imported;
    totalStats.totalPhotoLocations += stats.photoLocations.imported;
  }

  // Display summary
  console.log("\n=== Import Summary ===");
  console.log(`Maps Processed: ${totalStats.mapsProcessed}`);
  console.log(`Total Chests: ${totalStats.totalChests}`);
  console.log(`Total Story Items: ${totalStats.totalStoryItems}`);
  console.log(`Total Time Trials: ${totalStats.totalTimeTrials}`);
  console.log(`Total Photo Locations: ${totalStats.totalPhotoLocations}`);
  console.log(
    `Grand Total: ${totalStats.totalChests + totalStats.totalStoryItems + totalStats.totalTimeTrials + totalStats.totalPhotoLocations} collectibles`,
  );

  // Close database connections
  collectionManager.close();
  console.log("\n✓ Import complete!\n");
}

// Run import
importAllMaps().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
