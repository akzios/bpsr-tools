const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");
const fsPromises = require("fs").promises;
const fs = require("fs");
const { saveSettings } = require(path.join(__dirname, "utilities", "settings"));
const GoogleSheetsService = require(
  path.join(__dirname, "service", "googleSheets"),
);
const configPaths = require(path.join(__dirname, "utilities", "configPaths"));

const LOGS_DPS_PATH = path.join("./logs_dps.json");

function initializeApi(
  app,
  server,
  io,
  userDataManager,
  logger,
  globalSettings,
  sniffer,
) {
  // Detect dev mode
  const isDevMode =
    process.defaultApp ||
    process.env.NODE_ENV === "development" ||
    process.env.DEV_MODE === "true" ||
    process.argv.includes("--dev");

  app.use(cors());
  app.use(express.json({ charset: 'utf-8' }));

  // Serve compiled TypeScript from dist/public first (takes priority)
  app.use(express.static(path.join(__dirname, "..", "..", "dist", "public")));

  // In dev mode, fall back to source public folder for non-compiled files (CSS, HTML, assets)
  if (isDevMode) {
    logger.info("Dev mode: Serving source files from public/");
    app.use(express.static(path.join(__dirname, "..", "..", "public")));
  }

  // Set UTF-8 charset for API responses only
  app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  // Health check endpoint
  app.get("/-/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Serve app.html as the default page
  app.get("/", (req, res) => {
    const appHtmlPath = path.join(__dirname, "..", "..", "public", "app.html");
    res.sendFile(appHtmlPath);
  });

  app.get("/icon.png", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "icon.png")); // Adjust the path
  });

  app.get("/favicon.ico", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "icon.ico")); // Adjust the path
  });

  // Helper function to translate profession from Chinese to English
  function translateProfession(professionCn) {
    if (!professionCn) return professionCn;

    // Strip sub-profession first (handles both " - " and "·" separators)
    const mainClass = professionCn.split(/\s*[-·]\s*/)[0].trim();

    // Try to get profession details (works with both Chinese and English)
    const profession = userDataManager.professionDb.getByName(mainClass);
    if (profession && profession.name_en) {
      return profession.name_en;
    }

    // Fallback: check if already in English
    if (!/[\u4e00-\u9fa5]/.test(mainClass)) {
      return mainClass;
    }

    // Log untranslated - this means database isn't seeded
    console.log(
      `[Translation] WARNING: No translation found for profession: "${mainClass}"`,
    );
    console.log(
      `[Translation] Available professions:`,
      userDataManager.professionDb
        .getAllProfessions()
        .map((p) => `${p.name_cn} (${p.name_en})`),
    );

    return mainClass;
  }

  app.get("/api/data", (req, res) => {
    const userData = userDataManager.getAllUsersData();

    // Add full profession details to user data
    const modifiedUserData = {};
    Object.keys(userData).forEach((uid) => {
      const user = userData[uid];

      // Get profession details (works with both Chinese and English names)
      const mainClass = user.profession
        ? user.profession.split(/\s*[-·]\s*/)[0].trim()
        : null;
      const professionDetails = mainClass
        ? userDataManager.professionDb.getByName(mainClass)
        : null;

      // Debug logging
      if (!professionDetails && mainClass) {
        logger.debug(
          `[Profession Lookup] Failed to find profession for: "${mainClass}" (user: ${user.name})`,
        );
        logger.debug(
          `[Profession Lookup] Available professions:`,
          userDataManager.professionDb
            .getAllProfessions()
            .map((p) => `${p.name_cn} (${p.name_en})`),
        );
      }

      modifiedUserData[uid] = {
        ...user,
        professionDetails: professionDetails || {
          name_cn: mainClass || "Unknown",
          name_en: mainClass || "Unknown",
          icon: "unknown.png",
          role: "dps",
        },
      };
    });

    // Convert user object to array for CLI mode
    const usersArray = Object.keys(modifiedUserData).map((uid) => {
      const user = modifiedUserData[uid];
      return {
        uid: uid,
        name: user.name,
        professionDetails: user.professionDetails,
        level: user.player_level || null,
        totalDamage: user.totalDamage?.total || 0,
        dps: user.dps || 0,
        fightPoint: user.fightPoint || 0,
        currentHp: user.attr?.current_hp || 0,
        maxHp: user.attr?.max_hp || 0,
        critCount: user.totalDamage?.critHitCount || 0,
        luckCount: user.totalDamage?.luckHitCount || 0,
        hitCount: user.totalDamage?.hitCount || 0,
      };
    });

    // Calculate duration
    const duration = (Date.now() - userDataManager.startTime) / 1000;

    const data = {
      code: 0,
      user: modifiedUserData, // For GUI client
      data: {
        // For CLI client
        users: usersArray,
        duration: duration,
      },
    };
    res.json(data);
  });

  app.get("/api/enemies", (req, res) => {
    const enemiesData = userDataManager.getAllEnemiesData();
    const data = {
      code: 0,
      enemy: enemiesData,
    };
    res.json(data);
  });

  app.get("/api/clear", (req, res) => {
    userDataManager.clearAll(globalSettings); // Pass globalSettings
    console.log("Stats Cleared!");
    res.json({
      code: 0,
      msg: "Stats Cleared!",
    });
  });

  app.post("/api/clear-logs", async (req, res) => {
    const logsBaseDir = path.join(__dirname, "..", "..", "logs"); // Adjust the path
    try {
      const files = await fsPromises.readdir(logsBaseDir);
      for (const file of files) {
        const filePath = path.join(logsBaseDir, file);
        await fsPromises.rm(filePath, { recursive: true, force: true });
      }
      if (fs.existsSync(LOGS_DPS_PATH)) {
        await fsPromises.unlink(LOGS_DPS_PATH);
      }
      console.log("All log files and directories have been cleared!");
      res.json({
        code: 0,
        msg: "All log files and directories have been cleared!",
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log("The logs directory does not exist, no logs to clear.");
        res.json({
          code: 0,
          msg: "The logs directory does not exist, no logs to clear.",
        });
      } else {
        logger.error("Failed to clear log files:", error);
        res.status(500).json({
          code: 1,
          msg: "Failed to clear log files.",
          error: error.message,
        });
      }
    }
  });

  app.post("/api/pause", (req, res) => {
    const { paused } = req.body;
    globalSettings.isPaused = paused; // Update pause state in globalSettings
    if (sniffer) {
      sniffer.setPaused(paused); // Update pause state in sniffer
    }
    console.log(`Stats ${globalSettings.isPaused ? "paused" : "resumed"}!`);

    // Broadcast pause state change to all connected clients
    io.emit("pause-state-changed", { paused: globalSettings.isPaused });

    res.json({
      code: 0,
      msg: `Stats ${globalSettings.isPaused ? "paused" : "resumed"}!`,
      paused: globalSettings.isPaused,
    });
  });

  app.get("/api/pause", (req, res) => {
    res.json({
      code: 0,
      paused: globalSettings.isPaused,
    });
  });

  app.post("/api/set-username", (req, res) => {
    const { uid, name } = req.body;
    if (uid && name) {
      const userId = parseInt(uid, 10);
      if (!isNaN(userId)) {
        userDataManager.setName(userId, name);
        console.log(`Manually assigned name '${name}' to UID ${userId}`);
        res.json({ code: 0, msg: "Username updated successfully." });
      } else {
        res.status(400).json({ code: 1, msg: "Invalid UID." });
      }
    } else {
      res.status(400).json({ code: 1, msg: "Missing UID or name." });
    }
  });

  app.get("/api/skill/:uid", (req, res) => {
    const uid = parseInt(req.params.uid);
    const skillData = userDataManager.getUserSkillData(uid);

    if (!skillData) {
      return res.status(404).json({
        code: 1,
        msg: "User not found",
      });
    }

    res.json({
      code: 0,
      data: skillData,
    });
  });

  app.get("/api/history/:timestamp/summary", async (req, res) => {
    const { timestamp } = req.params;
    const historyFilePath = path.join("./logs", timestamp, "summary.json"); // Adjust the path

    try {
      const data = await fsPromises.readFile(historyFilePath, "utf8");
      const summaryData = JSON.parse(data);
      res.json({
        code: 0,
        data: summaryData,
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.warn("History summary file not found:", error);
        res.status(404).json({
          code: 1,
          msg: "History summary file not found",
        });
      } else {
        logger.error("Failed to read history summary file:", error);
        res.status(500).json({
          code: 1,
          msg: "Failed to read history summary file",
        });
      }
    }
  });

  app.get("/api/history/:timestamp/data", async (req, res) => {
    const { timestamp } = req.params;
    const historyFilePath = path.join("./logs", timestamp, "allUserData.json"); // Adjust the path

    try {
      const data = await fsPromises.readFile(historyFilePath, "utf8");
      const userData = JSON.parse(data);
      res.json({
        code: 0,
        user: userData,
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.warn("History data file not found:", error);
        res.status(404).json({
          code: 1,
          msg: "History data file not found",
        });
      } else {
        logger.error("Failed to read history data file:", error);
        res.status(500).json({
          code: 1,
          msg: "Failed to read history data file",
        });
      }
    }
  });

  app.get("/api/history/:timestamp/skill/:uid", async (req, res) => {
    const { timestamp, uid } = req.params;
    const historyFilePath = path.join(
      "./logs",
      timestamp,
      "users",
      `${uid}.json`,
    ); // Adjust the path

    try {
      const data = await fsPromises.readFile(historyFilePath, "utf8");
      const skillData = JSON.parse(data);
      res.json({
        code: 0,
        data: skillData,
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.warn("History skill file not found:", error);
        res.status(404).json({
          code: 1,
          msg: "History skill file not found",
        });
      } else {
        logger.error("Failed to read history skill file:", error);
        res.status(500).json({
          code: 1,
          msg: "Failed to load history skill file",
        });
      }
    }
  });

  app.get("/api/history/:timestamp/download", async (req, res) => {
    const { timestamp } = req.params;
    const historyFilePath = path.join("./logs", timestamp, "fight.log"); // Adjust the path
    res.download(historyFilePath, `fight_${timestamp}.log`);
  });

  app.get("/api/history/list", async (req, res) => {
    try {
      const data = (await fsPromises.readdir("./logs", { withFileTypes: true })) // Adjust the path
        .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
        .map((e) => e.name);
      res.json({
        code: 0,
        data: data,
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.warn("History path not found:", error);
        res.status(404).json({
          code: 1,
          msg: "History path not found",
        });
      } else {
        logger.error("Failed to load history path:", error);
        res.status(500).json({
          code: 1,
          msg: "Failed to load history path",
        });
      }
    }
  });

  app.get("/api/settings", async (req, res) => {
    res.json({ code: 0, data: globalSettings });
  });

  app.post("/api/settings", async (req, res) => {
    const newSettings = req.body;
    const oldTheme = globalSettings.theme;
    Object.assign(globalSettings, newSettings); // Update globalSettings directly

    // Filter out isPaused before saving (it's runtime-only state)
    const { isPaused, ...settingsToSave } = globalSettings;
    saveSettings(settingsToSave);

    // Broadcast theme change to all connected clients if theme changed
    if (newSettings.theme && newSettings.theme !== oldTheme) {
      io.emit("theme-changed", { theme: newSettings.theme });
    }

    res.json({ code: 0, data: globalSettings });
  });

  // Profession API endpoints
  app.get("/api/professions", (req, res) => {
    try {
      const professions = userDataManager.professionDb.getAllProfessions();

      // Transform to map format for frontend compatibility
      const professionMap = {};

      professions.forEach((prof) => {
        professionMap[prof.name_cn] = {
          name: prof.name_en,
          icon: prof.icon,
          role: prof.role,
        };
      });

      res.json({ code: 0, data: professionMap });
    } catch (error) {
      1;
      logger.error("Failed to fetch professions:", error);
      res.status(500).json({
        code: 1,
        msg: "Failed to load professions",
        error: error.message,
      });
    }
  });

  function saveDpsLog(log) {
    if (!globalSettings.enableDpsLog) return;

    let logs = [];
    if (fs.existsSync(LOGS_DPS_PATH)) {
      logs = JSON.parse(fs.readFileSync(LOGS_DPS_PATH, "utf8"));
    }
    logs.unshift(log);
    fs.writeFileSync(LOGS_DPS_PATH, JSON.stringify(logs, null, 2));
  }

  app.post("/save-dps-log", (req, res) => {
    const log = req.body;
    saveDpsLog(log);
    res.sendStatus(200);
  });

  app.get("/logs-dps", (req, res) => {
    let logs = [];
    if (fs.existsSync(LOGS_DPS_PATH)) {
      logs = JSON.parse(fs.readFileSync(LOGS_DPS_PATH, "utf8"));
    }
    res.json(logs);
  });

  // Google Sheets sync endpoint
  app.post("/api/sync-sheets", async (req, res) => {
    try {
      // Check if sheets.json exists
      const sheetsPath = configPaths.getConfigPath("sheets.json");
      if (!fs.existsSync(sheetsPath)) {
        return res.status(404).json({
          code: 1,
          msg: "Google Sheets not configured. Please configure sheets.json in settings.",
        });
      }

      // Load sheets config
      const sheetsConfig = JSON.parse(fs.readFileSync(sheetsPath, "utf8"));

      // Initialize Google Sheets service
      const sheetsService = new GoogleSheetsService(logger);
      const initialized = await sheetsService.initialize();

      if (!initialized) {
        return res.status(500).json({
          code: 1,
          msg: "Failed to initialize Google Sheets service",
        });
      }

      // Get current player data
      const userData = userDataManager.getAllUsersData();

      // Filter out players without valid data and translate professions
      const validPlayers = Object.values(userData)
        .filter(
          (user) => user.name && user.name !== "Unknown" && user.fightPoint > 0,
        )
        .map((user) => ({
          uid: String(user.uid), // Ensure UID is a string for consistent comparison
          name: user.name,
          fightPoint: user.fightPoint,
          profession: translateProfession(user.profession), // Translate to English
        }));

      if (validPlayers.length === 0) {
        return res.json({
          code: 0,
          msg: "No valid player data to sync",
          synced: 0,
        });
      }

      // Sync to Google Sheets
      const result = await sheetsService.updatePlayerData(
        sheetsConfig.spreadsheetId,
        sheetsConfig.sheetName || "PlayerInfo",
        validPlayers,
      );

      if (result.success) {
        logger.info(
          `[Sheets] Synced ${result.total} players (${result.new} new, ${result.updated} updated)`,
        );
        res.json({
          code: 0,
          msg: `Successfully synced ${result.total} players`,
          synced: result.total,
          new: result.new,
          updated: result.updated,
        });
      } else {
        res.status(500).json({
          code: 1,
          msg: result.error || "Failed to sync to Google Sheets",
        });
      }
    } catch (error) {
      logger.error(`[Sheets] Sync error: ${error.message}`);
      res.status(500).json({
        code: 1,
        msg: "Error syncing to Google Sheets: " + error.message,
      });
    }
  });

  // Check if Google Sheets is configured
  app.get("/api/sheets-configured", (req, res) => {
    try {
      const sheetsPath = configPaths.getConfigPath("sheets.json");
      const configured = fs.existsSync(sheetsPath);
      res.json({
        code: 0,
        configured: configured,
      });
    } catch (error) {
      res.json({
        code: 0,
        configured: false,
      });
    }
  });

  // Update database with fresh seed data
  app.post("/api/update-database", async (req, res) => {
    try {
      const { updateDatabase } = require(
        path.join(__dirname, "utilities", "updateDatabase"),
      );

      // Get paths
      const userDbPath = path.join(configPaths.getDbPath(), "bpsr-tools.db");
      const projectRoot = path.join(__dirname, "..", "..");

      logger.info("[API] Database update requested");
      console.log("[API] Starting manual database update...");

      // Run the update
      const stats = await updateDatabase(userDbPath, projectRoot);

      if (stats.success) {
        logger.info(
          `[API] Database updated: +${stats.professions} professions, +${stats.monsters} monsters, +${stats.skills} skills, +${stats.players} players`,
        );
        res.json({
          code: 0,
          msg: "Database updated successfully",
          data: {
            professions: stats.professions,
            monsters: stats.monsters,
            skills: stats.skills,
            players: stats.players,
          },
        });
      } else {
        logger.error(
          `[API] Database update failed: ${stats.errors.join(", ")}`,
        );
        res.status(500).json({
          code: 1,
          msg: "Database update failed",
          errors: stats.errors,
        });
      }
    } catch (error) {
      logger.error(`[API] Database update error: ${error.message}`);
      res.status(500).json({
        code: 1,
        msg: "Error updating database: " + error.message,
      });
    }
  });

  io.on("connection", (socket) => {
    console.log("WebSocket client connected: " + socket.id);

    socket.on("disconnect", () => {
      console.log("WebSocket client disconnected: " + socket.id);
    });
  });

  // Emit scene data updates (50ms for smooth position tracking)
  let lastLoggedSceneData = null;
  setInterval(() => {
    if (!globalSettings.isPaused) {
      const sceneData = userDataManager.getSceneData();
      if (sceneData) {
        io.emit("scene-update", sceneData);

        // Scene update logging disabled
        // const currentSnapshot = JSON.stringify({
        //   scene: sceneData.scene,
        //   position: sceneData.player.pos,
        // });
        //
        // if (currentSnapshot !== lastLoggedSceneData) {
        //   console.log("[Scene Update]", JSON.stringify(sceneData, null, 2));
        //   lastLoggedSceneData = currentSnapshot;
        // }
      }
    }
  }, 50); // 20 updates/sec for smooth minimap movement

  // Emit combat data updates (100ms)
  setInterval(() => {
    if (!globalSettings.isPaused) {
      const userData = userDataManager.getAllUsersData();

      // Add full profession details to user data
      const modifiedUserData = {};
      Object.keys(userData).forEach((uid) => {
        const user = userData[uid];

        // Get profession details (works with both Chinese and English names)
        const mainClass = user.profession
          ? user.profession.split(/\s*[-·]\s*/)[0].trim()
          : null;
        const professionDetails = mainClass
          ? userDataManager.professionDb.getByName(mainClass)
          : null;

        modifiedUserData[uid] = {
          ...user,
          professionDetails: professionDetails || {
            name_cn: mainClass || "Unknown",
            name_en: mainClass || "Unknown",
            icon: "unknown.png",
            role: "dps",
          },
        };
      });

      const data = {
        code: 0,
        user: modifiedUserData,
      };
      io.emit("data", data);
    }
  }, 100);

  // Emit skill breakdown updates (100ms - same as combat data)
  let skillDataEmitCount = 0;
  setInterval(() => {
    if (!globalSettings.isPaused) {
      const userData = userDataManager.getAllUsersData();
      const skillBreakdowns = {};

      // Get skill breakdown for each active player
      Object.keys(userData).forEach((uid) => {
        const skillData = userDataManager.getUserSkillData(parseInt(uid));
        if (skillData) {
          skillBreakdowns[uid] = skillData;
        }
      });

      // Log every 10 seconds (20 emissions) - detailed target damage info
      if (skillDataEmitCount % 20 === 0 && Object.keys(skillBreakdowns).length > 0) {
        const firstUid = Object.keys(skillBreakdowns)[0];
        const firstPlayer = skillBreakdowns[firstUid];
        logger.info('[skill-data] Emitting to clients:', {
          playerCount: Object.keys(skillBreakdowns).length,
          samplePlayer: firstUid,
          sampleTargetDamageCount: firstPlayer.targetDamage?.length || 0,
          sampleTargetDamage: firstPlayer.targetDamage?.map(t => ({
            name: t.monsterName,
            dmg: t.totalDamage
          })) || [],
          sampleSkillCount: Object.keys(firstPlayer.skills || {}).length,
        });
      }
      skillDataEmitCount++;

      io.emit("skill-data", {
        code: 0,
        data: skillBreakdowns,
      });
    }
  }, 500);

  // ===== Collectibles API Endpoints =====

  /**
   * GET /api/collectibles/:mapId
   * Get all collectibles for a specific map
   * Optional query param: userId for progress tracking
   */
  app.get("/api/collectibles/:mapId", (req, res) => {
    try {
      const mapId = parseInt(req.params.mapId);
      const userId = req.query.userId ? parseInt(req.query.userId) : null;

      if (isNaN(mapId)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid map ID",
        });
      }

      if (!req.app.locals.collectionManager) {
        return res.status(503).json({
          code: 1,
          msg: "Collection manager not initialized",
        });
      }

      const collectionManager = req.app.locals.collectionManager;

      // Get collectibles with or without user progress
      const collectibles = userId
        ? collectionManager.getAllForMapWithProgress(mapId, userId)
        : collectionManager.getAllForMap(mapId);

      res.json({
        code: 0,
        mapId,
        collectibles,
      });
    } catch (error) {
      logger.error(
        `[Collectibles API] Error fetching collectibles: ${error.message}`,
      );
      res.status(500).json({
        code: 1,
        msg: "Failed to fetch collectibles",
        error: error.message,
      });
    }
  });

  /**
   * GET /api/collectibles/:mapId/statistics
   * Get collectible statistics for a specific map
   * Optional query param: userId for progress
   */
  app.get("/api/collectibles/:mapId/statistics", (req, res) => {
    try {
      const mapId = parseInt(req.params.mapId);
      const userId = req.query.userId ? parseInt(req.query.userId) : null;

      if (isNaN(mapId)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid map ID",
        });
      }

      if (!req.app.locals.collectionManager) {
        return res.status(503).json({
          code: 1,
          msg: "Collection manager not initialized",
        });
      }

      const collectionManager = req.app.locals.collectionManager;
      const statistics = collectionManager.getStatistics(mapId, userId);

      res.json({
        code: 0,
        mapId,
        statistics,
      });
    } catch (error) {
      logger.error(
        `[Collectibles API] Error fetching statistics: ${error.message}`,
      );
      res.status(500).json({
        code: 1,
        msg: "Failed to fetch statistics",
        error: error.message,
      });
    }
  });

  /**
   * POST /api/collections/mark
   * Mark a collectible as collected by a user
   */
  app.post("/api/collections/mark", (req, res) => {
    try {
      const { userId, collectionType, collectibleId, mapId } = req.body;

      if (!userId || !collectionType || !collectibleId || !mapId) {
        return res.status(400).json({
          code: 1,
          msg: "Missing required fields: userId, collectionType, collectibleId, mapId",
        });
      }

      const userIdInt = parseInt(userId);
      const collectibleIdInt = parseInt(collectibleId);
      const mapIdInt = parseInt(mapId);

      if (isNaN(userIdInt) || isNaN(collectibleIdInt) || isNaN(mapIdInt)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid ID format",
        });
      }

      if (!req.app.locals.collectionManager) {
        return res.status(503).json({
          code: 1,
          msg: "Collection manager not initialized",
        });
      }

      const collectionManager = req.app.locals.collectionManager;
      const success = collectionManager.markCollected(
        userIdInt,
        collectionType,
        collectibleIdInt,
        mapIdInt,
      );

      if (success) {
        res.json({
          code: 0,
          msg: "Collectible marked as collected",
        });
      } else {
        res.json({
          code: 0,
          msg: "Collectible was already collected",
        });
      }
    } catch (error) {
      logger.error(
        `[Collectibles API] Error marking collected: ${error.message}`,
      );
      res.status(500).json({
        code: 1,
        msg: "Failed to mark collectible",
        error: error.message,
      });
    }
  });

  /**
   * DELETE /api/collections/mark
   * Remove a collected item
   */
  app.delete("/api/collections/mark", (req, res) => {
    try {
      const { userId, collectionType, collectibleId } = req.body;

      if (!userId || !collectionType || !collectibleId) {
        return res.status(400).json({
          code: 1,
          msg: "Missing required fields: userId, collectionType, collectibleId",
        });
      }

      const userIdInt = parseInt(userId);
      const collectibleIdInt = parseInt(collectibleId);

      if (isNaN(userIdInt) || isNaN(collectibleIdInt)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid ID format",
        });
      }

      if (!req.app.locals.collectionManager) {
        return res.status(503).json({
          code: 1,
          msg: "Collection manager not initialized",
        });
      }

      const collectionManager = req.app.locals.collectionManager;
      const success = collectionManager.removeCollected(
        userIdInt,
        collectionType,
        collectibleIdInt,
      );

      if (success) {
        res.json({
          code: 0,
          msg: "Collectible unmarked",
        });
      } else {
        res.json({
          code: 1,
          msg: "Collectible was not found in collection",
        });
      }
    } catch (error) {
      logger.error(
        `[Collectibles API] Error removing collected: ${error.message}`,
      );
      res.status(500).json({
        code: 1,
        msg: "Failed to remove collectible",
        error: error.message,
      });
    }
  });

  /**
   * GET /api/collections/progress/:userId
   * Get overall collection progress for a user
   */
  app.get("/api/collections/progress/:userId", (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid user ID",
        });
      }

      if (!req.app.locals.collectionManager) {
        return res.status(503).json({
          code: 1,
          msg: "Collection manager not initialized",
        });
      }

      const collectionManager = req.app.locals.collectionManager;
      const progress =
        collectionManager.userCollections.getOverallProgress(userId);

      res.json({
        code: 0,
        userId,
        progress,
      });
    } catch (error) {
      logger.error(
        `[Collectibles API] Error fetching progress: ${error.message}`,
      );
      res.status(500).json({
        code: 1,
        msg: "Failed to fetch progress",
        error: error.message,
      });
    }
  });

  // ============================================
  // Session API Endpoints
  // ============================================

  /**
   * GET /api/sessions/temporary
   * Get current temporary session stats (in-memory, not saved to DB)
   */
  app.get("/api/sessions/temporary", (req, res) => {
    try {
      const tempSession = userDataManager.getTemporarySessionStats();

      if (!tempSession) {
        return res.json({
          code: 0,
          data: null,
          msg: "No active temporary session",
        });
      }

      res.json({
        code: 0,
        data: tempSession,
      });
    } catch (error) {
      logger.error("[API] Error getting temporary session:", error);
      res.status(500).json({
        code: 1,
        msg: "Failed to get temporary session",
        error: error.message,
      });
    }
  });

  /**
   * GET /api/sessions/list
   * Get all sessions with pagination
   */
  app.get("/api/sessions/list", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      if (!req.app.locals.sessionDb) {
        return res.status(503).json({
          code: 1,
          msg: "Session database not initialized",
        });
      }

      const sessions = req.app.locals.sessionDb.getAllSessions(limit, offset);

      res.json({
        code: 0,
        data: sessions,
      });
    } catch (error) {
      logger.error(`[Session API] Error fetching sessions: ${error.message}`);
      res.status(500).json({
        code: 1,
        msg: "Failed to fetch sessions",
        error: error.message,
      });
    }
  });

  /**
   * GET /api/sessions/active
   * Get all active sessions
   */
  app.get("/api/sessions/active", async (req, res) => {
    try {
      if (!req.app.locals.sessionDb) {
        return res.status(503).json({
          code: 1,
          msg: "Session database not initialized",
        });
      }

      const sessions = req.app.locals.sessionDb.getActiveSessions();

      res.json({
        code: 0,
        data: sessions,
      });
    } catch (error) {
      logger.error(
        `[Session API] Error fetching active sessions: ${error.message}`,
      );
      res.status(500).json({
        code: 1,
        msg: "Failed to fetch active sessions",
        error: error.message,
      });
    }
  });

  /**
   * GET /api/sessions/:id
   * Get session by ID with full details (players and fights)
   */
  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);

      if (isNaN(sessionId)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid session ID",
        });
      }

      if (!req.app.locals.sessionDb) {
        return res.status(503).json({
          code: 1,
          msg: "Session database not initialized",
        });
      }

      const session = req.app.locals.sessionDb.getSessionWithDetails(sessionId);

      if (!session) {
        return res.status(404).json({
          code: 1,
          msg: "Session not found",
        });
      }

      res.json({
        code: 0,
        data: session,
      });
    } catch (error) {
      logger.error(`[Session API] Error fetching session: ${error.message}`);
      res.status(500).json({
        code: 1,
        msg: "Failed to fetch session",
        error: error.message,
      });
    }
  });

  /**
   * POST /api/sessions/create
   * Create a new session
   * If a temporary session is active, use its start time and clear it after saving
   */
  app.post("/api/sessions/create", async (req, res) => {
    try {
      const { session_name, type } = req.body;

      if (!req.app.locals.sessionDb) {
        return res.status(503).json({
          code: 1,
          msg: "Session database not initialized",
        });
      }

      // Check if there's an active temporary session
      const tempSession = userDataManager.getTemporarySessionStats();
      const startTime = tempSession ? tempSession.startTime : Date.now();

      const sessionId = req.app.locals.sessionDb.createSession(
        session_name,
        type || 'Open World',
        startTime,
      );

      // Clear temporary session after saving to DB
      if (tempSession) {
        userDataManager.clearTemporarySession();
        logger.info(`[Session API] Converted temporary session to permanent (ID: ${sessionId})`);
      }

      res.json({
        code: 0,
        data: {
          session_id: sessionId,
          was_temporary: !!tempSession,
        },
      });
    } catch (error) {
      logger.error(`[Session API] Error creating session: ${error.message}`);
      res.status(500).json({
        code: 1,
        msg: "Failed to create session",
        error: error.message,
      });
    }
  });

  /**
   * POST /api/sessions/:id/save
   * Save current combat data to session
   */
  app.post("/api/sessions/:id/save", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);

      if (isNaN(sessionId)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid session ID",
        });
      }

      if (!req.app.locals.sessionDb) {
        return res.status(503).json({
          code: 1,
          msg: "Session database not initialized",
        });
      }

      // Get combat data from request body or fallback to server data
      const combatData = req.body.combatData || userDataManager.getAllUsersData();

      logger.debug(`[Session API] Raw combat data keys:`, Object.keys(combatData));

      const users = Object.keys(combatData).map((uid) => {
        const userData = combatData[uid];
        return {
          uid: parseInt(uid),
          ...userData,
        };
      });

      logger.info(`[Session API] Saving ${users.length} players to session ${sessionId}`);

      if (users.length > 0) {
        logger.debug(`[Session API] Sample user data:`, JSON.stringify({
          uid: users[0].uid,
          name: users[0].name,
          totalDamage: users[0].totalDamage?.total,
          professionDetails: users[0].professionDetails,
        }, null, 2));
      }

      // Calculate session stats from all players
      let totalDamage = 0;
      let totalHealing = 0;
      let maxDps = 0;
      let maxHps = 0;

      users.forEach((user) => {
        const userDamage = user.totalDamage?.total || 0;
        const userHealing = user.totalHealing?.total || 0;

        totalDamage += userDamage;
        totalHealing += userHealing;
        maxDps = Math.max(maxDps, user.realtimeDpsMax || 0);
        maxHps = Math.max(maxHps, user.realtimeHpsMax || 0);

        logger.debug(`[Session API] User ${user.name} (${user.uid}): damage=${userDamage}, healing=${userHealing}`);
      });

      // Save each player to session (fetch skills separately as they're not in summary)
      users.forEach((user) => {
        // Fetch skill data for this player
        const skillData = userDataManager.getUserSkillData(user.uid);
        const skills = skillData?.skills || {};
        const targetDamage = skillData?.targetDamage || [];

        // Calculate combat duration for this player's session
        const combatDuration = skillData?.attr?.combat_duration || 1;

        // Calculate total hits from skills
        let totalHits = 0;
        let totalDamageFromSkills = 0;
        Object.values(skills).forEach((skill) => {
          totalHits += skill.totalCount || 0;
          totalDamageFromSkills += skill.totalDamage || 0;
        });

        // Enrich skill data with calculated statistics
        const enrichedSkills = {};
        Object.keys(skills).forEach((skillId) => {
          const skill = skills[skillId];
          const skillTotalCount = skill.totalCount || 0;
          const skillTotalDamage = skill.totalDamage || 0;

          enrichedSkills[skillId] = {
            ...skill,
            // Damage percentage
            damagePercent: totalDamageFromSkills > 0 ? skillTotalDamage / totalDamageFromSkills : 0,
            // DPS/HPS for this skill
            dpsHps: combatDuration > 0 ? skillTotalDamage / combatDuration : 0,
            // Average damage per hit
            avgPerHit: skillTotalCount > 0 ? skillTotalDamage / skillTotalCount : 0,
            // Normal hit average
            normAvg: (skill.countBreakdown?.normal || 0) > 0
              ? (skill.damageBreakdown?.normal || 0) / skill.countBreakdown.normal
              : 0,
            // Critical hit average
            critAvg: (skill.countBreakdown?.critical || 0) > 0
              ? (skill.damageBreakdown?.critical || 0) / skill.countBreakdown.critical
              : 0,
            // Hits per minute
            hitsPerMinute: combatDuration > 0 ? (skillTotalCount / combatDuration) * 60 : 0,
            // Hits per second
            hitsPerSecond: combatDuration > 0 ? skillTotalCount / combatDuration : 0,
          };
        });

        logger.debug(`[Session API] Player ${user.name} (UID: ${user.uid}): ${Object.keys(skills).length} skills, fightPoint=${user.fightPoint}`);

        const playerData = {
          player_id: user.uid,
          player_name: user.name,
          profession_id: user.professionDetails?.id || null,
          total_damage: user.totalDamage?.total || 0,
          total_healing: user.totalHealing?.total || 0,
          total_dps: user.totalDps || 0,
          total_hps: user.totalHps || 0,
          max_dps: user.realtimeDpsMax || 0,
          max_hps: user.realtimeHpsMax || 0,
          fight_point: user.fightPoint || 0,
          total_count: totalHits,
          taken_damage: user.takenDamage || 0,
          dead_count: user.deadCount || 0,
          hp: user.hp || 0,
          max_hp: user.maxHp || 0,
          skill_breakdown: enrichedSkills,
          time_series_data: user.timeSeriesData || [],
          target_damage: targetDamage,
        };
        req.app.locals.sessionDb.addSessionPlayer(sessionId, playerData);
      });

      // Update session with aggregate stats
      const session = req.app.locals.sessionDb.getSession(sessionId);
      const duration = Date.now() - session.start_time;
      const avgDps = duration > 0 ? (totalDamage / duration) * 1000 : 0;
      const avgHps = duration > 0 ? (totalHealing / duration) * 1000 : 0;

      logger.info(`[Session API] Session ${sessionId} totals: damage=${totalDamage}, healing=${totalHealing}, duration=${duration}ms, avgDps=${avgDps.toFixed(2)}`);

      // Update session (mark as completed when saved)
      req.app.locals.sessionDb.updateSession(sessionId, {
        end_time: Date.now(),
        duration: duration,
        total_damage: totalDamage,
        total_healing: totalHealing,
        avg_dps: avgDps,
        avg_hps: avgHps,
        max_dps: maxDps,
        max_hps: maxHps,
        player_count: users.length,
        is_active: 0, // Saved sessions are always completed
      });

      res.json({
        code: 0,
        data: {
          session_id: sessionId,
          players_saved: users.length,
        },
      });
    } catch (error) {
      logger.error(`[Session API] Error saving session: ${error.message}`);
      res.status(500).json({
        code: 1,
        msg: "Failed to save session",
        error: error.message,
      });
    }
  });

  /**
   * POST /api/sessions/:id/end
   * End an active session
   */
  app.post("/api/sessions/:id/end", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);

      if (isNaN(sessionId)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid session ID",
        });
      }

      if (!req.app.locals.sessionDb) {
        return res.status(503).json({
          code: 1,
          msg: "Session database not initialized",
        });
      }

      const session = req.app.locals.sessionDb.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          code: 1,
          msg: "Session not found",
        });
      }

      // Update session to inactive
      req.app.locals.sessionDb.updateSession(sessionId, {
        ...session,
        end_time: Date.now(),
        duration: Date.now() - session.start_time,
        is_active: 0,
      });

      res.json({
        code: 0,
        data: {
          session_id: sessionId,
        },
      });
    } catch (error) {
      logger.error(`[Session API] Error ending session: ${error.message}`);
      res.status(500).json({
        code: 1,
        msg: "Failed to end session",
        error: error.message,
      });
    }
  });

  /**
   * DELETE /api/sessions/:id
   * Delete a session
   */
  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);

      if (isNaN(sessionId)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid session ID",
        });
      }

      if (!req.app.locals.sessionDb) {
        return res.status(503).json({
          code: 1,
          msg: "Session database not initialized",
        });
      }

      req.app.locals.sessionDb.deleteSession(sessionId);

      res.json({
        code: 0,
        data: {
          session_id: sessionId,
        },
      });
    } catch (error) {
      logger.error(`[Session API] Error deleting session: ${error.message}`);
      res.status(500).json({
        code: 1,
        msg: "Failed to delete session",
        error: error.message,
      });
    }
  });

  app.post("/api/sessions/:id/rename", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { name, notes, type } = req.body;

      if (isNaN(sessionId)) {
        return res.status(400).json({
          code: 1,
          msg: "Invalid session ID",
        });
      }

      if (!req.app.locals.sessionDb) {
        return res.status(503).json({
          code: 1,
          msg: "Session database not initialized",
        });
      }

      const session = req.app.locals.sessionDb.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          code: 1,
          msg: "Session not found",
        });
      }

      const updates = {};

      if (name !== undefined && typeof name === 'string') {
        updates.session_name = name.trim();
      }

      if (notes !== undefined && typeof notes === 'string') {
        updates.notes = notes.trim();
      }

      if (type !== undefined && typeof type === 'string') {
        updates.type = type.trim();
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          code: 1,
          msg: "No valid updates provided",
        });
      }

      req.app.locals.sessionDb.updateSessionMetadata(sessionId, updates);

      res.json({
        code: 0,
        data: {
          session_id: sessionId,
          ...updates,
        },
      });
    } catch (error) {
      logger.error(`[Session API] Error updating session metadata: ${error.message}`);
      res.status(500).json({
        code: 1,
        msg: "Failed to update session metadata",
        error: error.message,
      });
    }
  });

}

module.exports = initializeApi;
