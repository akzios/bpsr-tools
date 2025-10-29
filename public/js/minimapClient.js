/**
 * BPSR Tools - Minimap Client (Simplified Tile Display)
 * Based on tile-test.html approach - just display tiles with zoom
 */

let socket;
let map;
let currentTileLayer = null;
let currentMapId = null;
let collectibles = null;
let currentMapConfig = null;

// Layer group for collectible markers
let collectibleLayer = L.layerGroup();

// Game coordinate bounds for each map (calculated from collectibles data)
// COMMENTED OUT - Using raw coordinates directly
// const mapBounds = {
//   7: { minX: -668.89, maxX: 908.13, minY: -1052.98, maxY: 813.15 },      // Asteria Plains
//   8: { minX: -412.08, maxX: 697.84, minY: -236.31, maxY: 420.40 },       // Asterleeds
//   71: { minX: -163.38, maxX: 158.93, minY: -84.90, maxY: 425.61 },       // Duskdye Woods
//   72: { minX: -119.14, maxX: 115.63, minY: 59.33, maxY: 376.11 },        // Everfall Forest
//   73: { minX: -373.25, maxX: 495.47, minY: 2.04, maxY: 466.61 },         // Windhowl Canyon
//   74: { minX: -344.08, maxX: 51.32, minY: -57.77, maxY: 273.79 },        // Underground District
//   75: { minX: -103.20, maxX: 206.44, minY: -100.97, maxY: 172.38 }       // Skimmer's Lair
// };

// Map configuration - TILES ARE 512x512!
const tileSize = 512;
const maxZoom = 3;
const gridSize = Math.pow(2, maxZoom); // 8 tiles at zoom 3
const mapSize = gridSize * tileSize; // 4096 pixels

// Map IDs to tile names with bounds
// Bounds calculated from collectible data: [[minY, minX], [maxY, maxX]]
const mapIdToTileConfig = {
  7: {
    name: "asteria_plains",
    displayName: "Asteria Plains",
    bounds: [
      [-1052.98, -668.89],
      [813.15, 908.13],
    ],
  },
  8: {
    name: "asterleeds",
    displayName: "Asterleeds",
    bounds: [
      [-236.31, -412.08],
      [420.4, 697.84],
    ],
  },
  71: {
    name: "duskdye_woods",
    displayName: "Duskdye Woods",
    bounds: [
      [-84.9, -163.38],
      [425.61, 158.93],
    ],
  },
  72: {
    name: "everfall_forest",
    displayName: "Everfall Forest",
    bounds: [
      [59.33, -119.14],
      [376.11, 115.63],
    ],
  },
  73: {
    name: "windhowl_canyon",
    displayName: "Windhowl Canyon",
    bounds: [
      [2.04, -373.25],
      [466.61, 495.47],
    ],
  },
  74: {
    name: "underground_district",
    displayName: "Underground District",
    bounds: [
      [-57.77, -344.08],
      [273.79, 51.32],
    ],
  },
  75: {
    name: "skimmer_s_lair",
    displayName: "Skimmer's Lair",
    bounds: [
      [-100.97, -103.2],
      [172.38, 206.44],
    ],
  },
};

/**
 * Convert game coordinates (X, Y) to pixel coordinates [0, 512]
 * Note: Y is the 2D vertical coordinate, Z is 3D elevation (ignored)
 * Maps to 512x512 base tile size (zoom 0)
 */
function gameToPixel(gameX, gameY, mapId) {
  const bounds = mapBounds[mapId];
  if (!bounds) {
    console.error(`[Coord] No bounds for map ${mapId}`);
    return [0, 0];
  }

  // Normalize game coordinates to [0, 1]
  const normalizedX = (gameX - bounds.minX) / (bounds.maxX - bounds.minX);
  const normalizedY = (gameY - bounds.minY) / (bounds.maxY - bounds.minY);

  // Map to 512x512 pixel space (base tile size)
  const pixelX = normalizedX * tileSize;
  const pixelY = normalizedY * tileSize;

  // Return as [Y, X] for Leaflet (Y is "latitude", X is "longitude")
  return [pixelY, pixelX];
}

/**
 * Initialize the Leaflet minimap
 */
function init() {
  console.log("[Minimap] Initializing simple tile display...");

  // Custom CRS with identity transformation (like tile-test.html)
  const customCRS = L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(1, 0, 1, 0),
    // Pure identity: no scaling, no offset, no inversion
  });

  // Create map with Simple CRS
  map = L.map("minimap", {
    crs: customCRS,
    minZoom: 0,
    maxZoom: 3,
    zoomControl: true,
    attributionControl: false,
  });

  // Set initial view - center at zoom 0, which is 256x256 pixels
  // At zoom 0, tile 0,0 covers [0-512, 0-512], so center at [256, 256]
  map.setView([256, 256], 0);

  console.log("[Minimap] Map initialized");
  console.log("[Minimap] Map size:", mapSize, "Tile size:", tileSize);

  // Add collectible layer to map
  collectibleLayer.addTo(map);

  // Load theme
  loadTheme();

  // Connect to Socket.IO
  const serverUrl = window.location.origin;
  socket = io(serverUrl);

  // Listen for scene updates
  socket.on("scene-update", handleSceneUpdate);

  // Listen for theme changes
  socket.on("theme-changed", (data) => {
    if (data && data.theme) {
      document.documentElement.setAttribute("data-theme", data.theme);
      console.log(`[Minimap] Theme changed to: ${data.theme}`);
    }
  });

  // Debug: log when socket connects
  socket.on("connect", () => {
    console.log("[Socket] Connected to server");
  });

  socket.on("disconnect", () => {
    console.log("[Socket] Disconnected from server");
  });

  console.log("[Minimap] Socket.IO initialized");
}

/**
 * Handle scene update from server
 */
function handleSceneUpdate(data) {
  // Log player position for debugging
  if (data && data.player && data.player.pos) {
    console.log(
      `[Player Position] X: ${data.player.pos.x.toFixed(2)}, Y: ${data.player.pos.y.toFixed(2)}, Z: ${data.player.pos.z.toFixed(2)}`,
    );
  }

  // Check if we have valid scene data
  const hasValidData = data && data.scene && data.scene.map_id;

  if (!hasValidData) {
    console.log("[Minimap] No valid scene data");
    showLoadingIndicator(true);
    return;
  }

  const mapId = data.scene.map_id;
  const mapConfig = mapIdToTileConfig[mapId];

  console.log(`[Minimap] Map ID: ${mapId}, Line: ${data.scene.line || "?"}`);

  if (!mapConfig) {
    console.log(`[Minimap] Unknown mapId: ${mapId}`);
    showLoadingIndicator(true);
    return;
  }

  showLoadingIndicator(false);

  // Update UI
  updateUI(data);

  // Load map tiles if map changed
  if (currentMapId !== mapId) {
    console.log(`[Minimap] Map changed from ${currentMapId} to ${mapId}`);
    loadMapTiles(mapId, mapConfig);
    fetchCollectibles(mapId);
    currentMapId = mapId;
  } else {
    console.log("[Minimap] Same map, no reload needed");
    // If collectibles aren't loaded yet, load them
    if (!collectibles) {
      console.log("[Minimap] Collectibles not loaded, fetching...");
      fetchCollectibles(mapId);
    } else {
      console.log(
        `[Minimap] Collectibles already loaded: ${collectibles.chests?.length || 0} chests`,
      );
      // Check if markers are visible
      const markerCount = collectibleLayer.getLayers().length;
      console.log(`[Minimap] Markers in layer: ${markerCount}`);
      if (markerCount === 0 && collectibles) {
        console.log("[Minimap] No markers visible, re-plotting...");
        plotCollectibles();
      }
    }
  }
}

/**
 * Load map tile layer for a specific map
 */
function loadMapTiles(mapId, mapConfig) {
  console.log(`[Minimap] Loading tiles for ${mapConfig.displayName}...`);

  // Remove old tile layer
  if (currentTileLayer) {
    console.log("[Minimap] Removing old tile layer");
    map.removeLayer(currentTileLayer);
  }

  // Custom tile layer with swapped coordinates for our tile naming convention
  const CustomTileLayer = L.TileLayer.extend({
    getTileUrl: function (coords) {
      // Swap X and Y to match our tile file naming convention
      const url = `assets/images/maps/tiles/${mapConfig.name}_${coords.z}_${coords.y}_${coords.x}.webp`;
      console.log(
        `[Tile] z=${coords.z}, x=${coords.x}, y=${coords.y} -> ${url}`,
      );
      return url;
    },
  });

  currentTileLayer = new CustomTileLayer("", {
    minZoom: 0,
    maxZoom: 3,
    tileSize: 512,
    noWrap: true,
    bounds: mapConfig.bounds, // Set bounds from map config
    errorTileUrl: "", // Don't show broken image for missing tiles
  });

  // Listen for tile load events
  let tilesLoaded = 0;
  let tilesErrored = 0;

  currentTileLayer.on("tileload", function (e) {
    tilesLoaded++;
    console.log(
      `[Tile] Loaded: ${e.coords.z}/${e.coords.x}/${e.coords.y} (Total: ${tilesLoaded})`,
    );
  });

  currentTileLayer.on("tileerror", function (e) {
    tilesErrored++;
    console.log(
      `[Tile] ERROR: ${e.coords.z}/${e.coords.x}/${e.coords.y} - ${e.tile.src}`,
    );
  });

  currentTileLayer.on("load", function () {
    console.log(
      `[Tiles] All tiles loaded: ${tilesLoaded} successful, ${tilesErrored} errors`,
    );
  });

  currentTileLayer.addTo(map);

  // Fit the map view to the bounds
  map.fitBounds(mapConfig.bounds);

  console.log(
    `[Minimap] Tiles loaded for ${mapConfig.displayName}, bounds:`,
    mapConfig.bounds,
  );
}

/**
 * Update UI elements
 */
function updateUI(data) {
  const sceneName = document.getElementById("scene-name");
  const mapInfo = document.getElementById("map-info");
  const mapId = data.scene?.map_id;
  const line = data.scene?.line;
  const mapConfig = mapIdToTileConfig[mapId];

  if (sceneName && mapConfig) {
    sceneName.textContent = mapConfig.displayName;
  }

  if (mapInfo) {
    mapInfo.textContent = `Map ID: ${mapId || "?"} | Line: ${line || "?"}`;
  }
}

/**
 * Show/hide loading indicator
 */
function showLoadingIndicator(show) {
  const indicator = document.getElementById("loading-indicator");
  if (indicator) {
    indicator.style.display = show ? "flex" : "none";
  }
}

/**
 * Load theme from localStorage
 */
function loadTheme() {
  const savedTheme = localStorage.getItem("bpsr-theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  console.log(`[Minimap] Theme loaded: ${savedTheme}`);
}

/**
 * Fetch collectibles for a map from API
 */
async function fetchCollectibles(mapId) {
  try {
    console.log(`[Collectibles] Fetching for map ${mapId}...`);
    const response = await fetch(`/api/collectibles/${mapId}`);
    const data = await response.json();

    if (data.code === 0) {
      collectibles = data.collectibles;
      console.log(
        `[Collectibles] Loaded: ${collectibles.chests?.length || 0} chests, ${collectibles.storyItems?.length || 0} story items, ${collectibles.timeTrials?.length || 0} time trials, ${collectibles.photoLocations?.length || 0} photo locations`,
      );

      // Plot collectibles on map
      plotCollectibles();
    } else {
      console.error(`[Collectibles] API error: ${data.msg || "Unknown error"}`);
    }
  } catch (error) {
    console.error(`[Collectibles] Failed to fetch:`, error);
  }
}

/**
 * Plot all collectibles on the map
 * Converts game coordinates to pixel coordinates
 */
function plotCollectibles() {
  // Clear existing markers
  collectibleLayer.clearLayers();

  if (!collectibles) return;

  console.log("[Collectibles] Plotting markers with raw coordinates...");
  console.log("[Collectibles] Current map ID:", currentMapId);

  // Plot chests
  if (collectibles.chests) {
    collectibles.chests.forEach((chest, i) => {
      // CBOR coordinate mapping: CBOR.x->GameZ, CBOR.y->GameX, CBOR.z->GameY
      // For 2D map we need [GameZ, GameX] = [CBOR.x, CBOR.y]
      const position = [chest.x, chest.y];

      if (i < 3) {
        console.log(
          `[Collectibles] Chest ${i}: CBOR(x=${chest.x.toFixed(2)}, y=${chest.y.toFixed(2)}) -> map[${position[0].toFixed(2)}, ${position[1].toFixed(2)}]`,
        );
      }

      const marker = L.circleMarker(position, {
        radius: 6,
        fillColor: "#FFD700", // Gold for chests
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      });

      marker.bindPopup(`
        <b>${chest.rarity || "Common"} Chest</b><br>
        X: ${chest.x.toFixed(2)}<br>
        Y: ${chest.y.toFixed(2)}<br>
        Z: ${chest.z.toFixed(2)}
      `);

      marker.addTo(collectibleLayer);
    });
    console.log(`[Collectibles] Plotted ${collectibles.chests.length} chests`);
  }

  // Plot story items
  if (collectibles.storyItems) {
    collectibles.storyItems.forEach((item) => {
      const position = [item.x, item.y];

      const marker = L.circleMarker(position, {
        radius: 6,
        fillColor: "#4CAF50", // Green for story items
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      });

      marker.bindPopup(`
        <b>Story Item</b><br>
        ${item.name || "Unknown"}<br>
        X: ${item.x.toFixed(2)}<br>
        Y: ${item.y.toFixed(2)}<br>
        Z: ${item.z.toFixed(2)}
      `);

      marker.addTo(collectibleLayer);
    });
    console.log(
      `[Collectibles] Plotted ${collectibles.storyItems.length} story items`,
    );
  }

  // Plot time trials
  if (collectibles.timeTrials) {
    collectibles.timeTrials.forEach((trial) => {
      const position = [trial.x, trial.y];

      const marker = L.circleMarker(position, {
        radius: 6,
        fillColor: "#2196F3", // Blue for time trials
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      });

      marker.bindPopup(`
        <b>Time Trial</b><br>
        X: ${trial.x.toFixed(2)}<br>
        Y: ${trial.y.toFixed(2)}<br>
        Z: ${trial.z.toFixed(2)}
      `);

      marker.addTo(collectibleLayer);
    });
    console.log(
      `[Collectibles] Plotted ${collectibles.timeTrials.length} time trials`,
    );
  }

  // Plot photo locations
  if (collectibles.photoLocations) {
    collectibles.photoLocations.forEach((photo) => {
      const position = [photo.x, photo.y];

      const marker = L.circleMarker(position, {
        radius: 6,
        fillColor: "#FF5722", // Orange for photo locations
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      });

      marker.bindPopup(`
        <b>Photo Location</b><br>
        ${photo.location_type || "Camera Point"}<br>
        X: ${photo.x.toFixed(2)}<br>
        Y: ${photo.y.toFixed(2)}<br>
        Z: ${photo.z.toFixed(2)}
      `);

      marker.addTo(collectibleLayer);
    });
    console.log(
      `[Collectibles] Plotted ${collectibles.photoLocations.length} photo locations`,
    );
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
