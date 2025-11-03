/**
 * Logger Utility
 * Simple logging utility for server-side operations
 */

const winston = require("winston");
const path = require("path");
const { app } = require("electron");

// Create logs directory in userData
const userDataPath = app ? app.getPath("userData") : ".";
const logsDir = path.join(userDataPath, "logs");

// Detect development mode
const isDevMode =
  process.defaultApp ||
  process.env.NODE_ENV === "development" ||
  process.env.DEV_MODE === "true";

// Log dev mode detection for debugging
if (isDevMode) {
  console.log(`[Logger] Dev mode detected - Log level: debug`);
  console.log(`[Logger] process.defaultApp: ${process.defaultApp}`);
  console.log(`[Logger] NODE_ENV: ${process.env.NODE_ENV}`);
} else {
  console.log(`[Logger] Production mode - Log level: info`);
}

// Create logger instance
const logger = winston.createLogger({
  level: isDevMode ? "debug" : "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "bpsr-tools" },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`,
        ),
      ),
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

/**
 * Create a prefixed logger for a specific module
 * @param {string} moduleName - The name of the module (e.g., "PlayerDB", "Sniffer")
 * @returns {Object} - Logger instance with prefixed messages
 */
function createLogger(moduleName) {
  const prefix = `[${moduleName}]`;

  return {
    info: (msg) => logger.info(`${prefix} ${msg}`),
    error: (msg) => logger.error(`${prefix} ${msg}`),
    warn: (msg) => logger.warn(`${prefix} ${msg}`),
    debug: (msg) => logger.debug(`${prefix} ${msg}`),
  };
}

module.exports = logger;
module.exports.createLogger = createLogger;
