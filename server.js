const winston = require("winston");
const readline = require("readline");
const path = require("path");
const fsPromises = require("fs").promises;
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const zlib = require("zlib");

const { UserDataManager } = require(
  path.join(__dirname, "src", "server", "dataManager"),
);
const Sniffer = require(path.join(__dirname, "src", "server", "sniffer"));
const initializeApi = require(path.join(__dirname, "src", "server", "api"));
const PacketProcessor = require(path.join(__dirname, "src", "algo", "packet"));
const configPaths = require(path.join(
  __dirname,
  "src",
  "server",
  "utilities",
  "configPaths",
));
const { loadSettings } = require(path.join(
  __dirname,
  "src",
  "server",
  "utilities",
  "settings",
));

// Read version from package.json
const packageJson = require(path.join(__dirname, "package.json"));
const VERSION = packageJson.version;

let globalSettings = loadSettings();

let server_port;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  // Initialize user config directory and copy defaults (critical for packaged apps!)
  configPaths.initializeUserConfigs();

  // Check for dev mode via environment variable or command line arg
  const isDevMode =
    process.env.DEV_MODE === "true" || process.argv.includes("--dev");

  // Create simple prefixed logger
  const logger = {
    info: (msg) => console.log(`[Server] ${msg}`),
    error: (msg) => console.error(`[Server] ${msg}`),
    warn: (msg) => console.warn(`[Server] ${msg}`),
    debug: (msg) => isDevMode && console.log(`[Server] ${msg}`),
  };

  if (isDevMode) {
    logger.info("🔧 DEV MODE ENABLED - All logs will be shown");
  }

  console.clear();
  console.log("###################################################");
  console.log("#                                                 #");
  console.log("#           BPSR Tools - Starting Up              #");
  console.log("#                                                 #");
  console.log("###################################################");
  console.log("\nInitializing service...");
  console.log("Detecting network traffic, please wait...");

  // Load global configuration from writable location
  const SETTINGS_PATH = configPaths.getConfigPath("settings.json");
  try {
    await fsPromises.access(SETTINGS_PATH);
    const data = await fsPromises.readFile(SETTINGS_PATH, "utf8");
    Object.assign(globalSettings, JSON.parse(data));
  } catch (e) {
    if (e.code !== "ENOENT") {
      logger.error("Failed to load settings:", e);
    }
  }

  const userDataManager = new UserDataManager(logger, globalSettings, VERSION);
  await userDataManager.initialize();

  // Auto-seed database if tables are missing or empty
  try {
    const PlayerModel = require(path.join(
      __dirname,
      "src",
      "server",
      "model",
      "player",
    ));
    const MonsterModel = require(path.join(
      __dirname,
      "src",
      "server",
      "model",
      "monster",
    ));
    const SkillModel = require(path.join(
      __dirname,
      "src",
      "server",
      "model",
      "skill",
    ));
    const ProfessionModel = require(path.join(
      __dirname,
      "src",
      "server",
      "model",
      "profession",
    ));
    const DatabaseSeeder = require(path.join(
      __dirname,
      "src",
      "server",
      "model",
      "seed",
    ));

    // Create seeding logger
    const seedLogger = {
      info: (msg) => logger.info(`[Seed] ${msg}`),
      error: (msg) => logger.error(`[Seed] ${msg}`),
      warn: (msg) => logger.warn(`[Seed] ${msg}`),
      debug: (msg) => isDevMode && logger.debug(`[Seed] ${msg}`),
    };

    // Initialize models
    const playerModel = new PlayerModel(seedLogger);
    playerModel.initialize();

    const monsterModel = new MonsterModel(seedLogger, playerModel.getDB());
    monsterModel.initialize();

    const skillModel = new SkillModel(seedLogger, playerModel.getDB());
    skillModel.initialize();

    const professionModel = new ProfessionModel(
      seedLogger,
      playerModel.getDB(),
    );
    professionModel.initialize();

    // Check if database needs seeding (only in development mode)
    const isPackaged = global.__isPackaged || false;

    if (!isPackaged) {
      const db = playerModel.getDB();
      const monstersCount = db
        .prepare("SELECT COUNT(*) as count FROM monsters")
        .get().count;
      const skillsCount = db
        .prepare("SELECT COUNT(*) as count FROM skills")
        .get().count;
      const professionsCount = db
        .prepare("SELECT COUNT(*) as count FROM professions")
        .get().count;

      if (monstersCount === 0 || skillsCount === 0 || professionsCount === 0) {
        logger.info(
          `Database seeding required (monsters: ${monstersCount}, skills: ${skillsCount}, professions: ${professionsCount})`,
        );
        const seeder = new DatabaseSeeder(
          seedLogger,
          playerModel,
          monsterModel,
          skillModel,
          professionModel,
        );
        const result = await seeder.seedAll();
        if (result.success) {
          logger.info(`Auto-seed completed: ${result.message}`);
        } else {
          logger.warn(`Auto-seed failed: ${result.message}`);
        }
      } else {
        logger.debug(
          `Database already seeded (monsters: ${monstersCount}, skills: ${skillsCount}, professions: ${professionsCount})`,
        );
      }
    } else {
      logger.debug(
        "Seeding skipped in packaged mode (using pre-packaged database)",
      );
    }

    // Close the seeding database connection
    playerModel.close();
  } catch (error) {
    logger.error(`Auto-seed error: ${error.message}`);
    // Continue anyway - don't block server startup
  }

  const sniffer = new Sniffer(logger, userDataManager, globalSettings); // Pass globalSettings to sniffer

  // Get device number and log level from command line arguments
  const args = process.argv.slice(2);
  let current_arg_index = 0;

  if (args[current_arg_index] && !isNaN(parseInt(args[current_arg_index]))) {
    server_port = parseInt(args[current_arg_index]);
    current_arg_index++;
  }

  let deviceNum = args[current_arg_index];

  try {
    await sniffer.start(deviceNum, PacketProcessor);
  } catch (error) {
    logger.error(`Error starting sniffer: ${error.message}`);
    rl.close();
    process.exit(1);
  }

  // Only reduce log level in production mode
  if (!isDevMode) {
    logger.level = "error";
  }

  process.on("SIGINT", async () => {
    console.log("\nClosing application...");
    rl.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\nClosing application...");
    rl.close();
    process.exit(0);
  });

  setInterval(() => {
    if (!globalSettings.isPaused) {
      userDataManager.updateAllRealtimeDps();
    }
  }, 100);

  if (server_port === undefined || server_port === null) {
    server_port = 8989;
  }

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  initializeApi(app, server, io, userDataManager, logger, globalSettings); // Initialize API with globalSettings

  server.listen(server_port, "0.0.0.0", () => {
    const localUrl = `http://localhost:${server_port}`;

    // Get local IP addresses
    const os = require("os");
    const networkInterfaces = os.networkInterfaces();
    const ipAddresses = [];

    for (const interfaceName in networkInterfaces) {
      for (const iface of networkInterfaces[interfaceName]) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === "IPv4" && !iface.internal) {
          ipAddresses.push(iface.address);
        }
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("BPSR Tools - Web Server Started");
    console.log(`${"=".repeat(60)}`);
    console.log(`\nLocal access: ${localUrl}`);

    // Output for Electron to detect server is ready
    console.log(`Web server started at ${localUrl}`);

    if (ipAddresses.length > 0) {
      console.log(`\nNetwork access (iPad/other devices):`);
      ipAddresses.forEach((ip) => {
        console.log(`  → http://${ip}:${server_port}`);
      });
    }

    console.log(`\n${"=".repeat(60)}\n`);
    console.log("WebSocket server: Ready");
  });

  console.log("Welcome to BPSR Tools!");
  console.log("Detecting game server, please wait...");

  // Interval to clean IP and TCP fragment cache, and API cache
  setInterval(() => {
    userDataManager.checkTimeoutClear();
    userDataManager.playerAPI.clearStaleCache();
  }, 10000);
}

if (!zlib.zstdDecompressSync) {
  console.log(
    "zstdDecompressSync is not available! Please update your Node.js!",
  );
  process.exit(1);
}

main();
