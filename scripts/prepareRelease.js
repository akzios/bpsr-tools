/**
 * Pre-build script to prepare for release
 * 1. Resets guiWindowBounds to center the window on first launch
 * 2. Copies static assets (CSS, HTML, images) to dist/public/ for production serving
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const settingsPath = path.join(rootDir, "config", "settings.json");
const publicDir = path.join(rootDir, "public");
const distPublicDir = path.join(rootDir, "dist", "public");

// Helper function to copy directory recursively
function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Helper function to copy file
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

console.log("[PrepareRelease] Preparing release build...\n");

// Step 1: Reset settings
console.log("[PrepareRelease] 1/2 Resetting guiWindowBounds to center...");
try {
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  settings.guiWindowBounds = {
    x: null,
    y: null,
    width: 700,
    height: 400,
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
  console.log("      ✓ Settings reset for release\n");
} catch (error) {
  console.error("      ✗ Failed to reset settings:", error.message);
  process.exit(1);
}

// Step 2: Copy static assets to dist/public/
console.log("[PrepareRelease] 2/2 Copying static assets to dist/public/...");
try {
  // Ensure dist/public exists
  if (!fs.existsSync(distPublicDir)) {
    fs.mkdirSync(distPublicDir, { recursive: true });
  }

  // Copy CSS files
  const cssSource = path.join(publicDir, "css");
  const cssDest = path.join(distPublicDir, "css");
  if (fs.existsSync(cssSource)) {
    copyRecursive(cssSource, cssDest);
    console.log("      ✓ Copied CSS files");
  }

  // Copy HTML files (all .html files in public root)
  const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));
  htmlFiles.forEach(file => {
    copyFile(
      path.join(publicDir, file),
      path.join(distPublicDir, file)
    );
  });
  if (htmlFiles.length > 0) {
    console.log(`      ✓ Copied ${htmlFiles.length} HTML file(s)`);
  }

  // Copy assets directory
  const assetsSource = path.join(publicDir, "assets");
  const assetsDest = path.join(distPublicDir, "assets");
  if (fs.existsSync(assetsSource)) {
    copyRecursive(assetsSource, assetsDest);
    console.log("      ✓ Copied assets directory");
  }

  console.log("\n[PrepareRelease] ✓ Release preparation complete!");
} catch (error) {
  console.error("\n[PrepareRelease] ✗ Failed to copy static assets:", error.message);
  process.exit(1);
}
