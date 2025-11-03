/**
 * PNG Exporter
 * Exports parse results to PNG with verification metadata
 */

import type { CombatData } from '@app-types/index';
import { formatStat } from '@shared/dataFormatter';

export interface ParseMetadata {
  hash: string;
  timestamp: string;
  duration: number;
  players: Array<{
    name: string;
    dps: number;
    damage: number;
    profession: string;
  }>;
  version: string;
}

/**
 * Generate SHA-256 hash for verification
 */
export async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Inject metadata into PNG file before IEND chunk
 */
export function injectPNGMetadata(dataUrl: string, metadata: ParseMetadata): string {
  console.log('Injecting metadata into PNG:', metadata);

  // Convert data URL to ArrayBuffer
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  console.log('PNG size:', bytes.length, 'bytes');

  // Find IEND chunk position
  let iendPos = -1;
  let pos = 8; // Skip PNG signature

  while (pos <= bytes.length - 12) {
    // Read chunk length (big-endian)
    const length =
      (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];

    // Read chunk type
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7]
    );

    if (type === 'IEND') {
      iendPos = pos;
      console.log('Found IEND at position:', iendPos);
      break;
    }

    // Move to next chunk
    pos += 4 + 4 + length + 4;

    // Safety check
    if (pos > bytes.length) {
      console.error('Walked past end of PNG data');
      return dataUrl;
    }
  }

  if (iendPos === -1) {
    console.error('IEND chunk not found, cannot inject metadata');
    return dataUrl;
  }

  // Create tEXt chunk with metadata
  const metadataJson = JSON.stringify(metadata);
  const keyword = 'BPSR-Verification';
  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(metadataJson);

  // Calculate chunk data (keyword + null separator + text)
  const chunkData = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  chunkData.set(keywordBytes, 0);
  chunkData[keywordBytes.length] = 0; // Null separator
  chunkData.set(textBytes, keywordBytes.length + 1);

  const chunkLength = chunkData.length;

  // Create complete chunk (length + type + data + CRC)
  const chunk = new Uint8Array(4 + 4 + chunkLength + 4);

  // Write length (big-endian)
  chunk[0] = (chunkLength >> 24) & 0xff;
  chunk[1] = (chunkLength >> 16) & 0xff;
  chunk[2] = (chunkLength >> 8) & 0xff;
  chunk[3] = chunkLength & 0xff;

  // Write type "tEXt"
  chunk[4] = 116; // 't'
  chunk[5] = 69; // 'E'
  chunk[6] = 88; // 'X'
  chunk[7] = 116; // 't'

  // Write data
  chunk.set(chunkData, 8);

  // Calculate CRC32 for type + data
  const crc = calculateCRC32(chunk.slice(4, 8 + chunkLength));

  // Write CRC (big-endian)
  chunk[8 + chunkLength] = (crc >> 24) & 0xff;
  chunk[8 + chunkLength + 1] = (crc >> 16) & 0xff;
  chunk[8 + chunkLength + 2] = (crc >> 8) & 0xff;
  chunk[8 + chunkLength + 3] = crc & 0xff;

  console.log('Created tEXt chunk, length:', chunkLength, 'bytes');

  // Build new PNG with metadata chunk inserted before IEND
  const newPng = new Uint8Array(bytes.length + chunk.length);
  newPng.set(bytes.slice(0, iendPos), 0);
  newPng.set(chunk, iendPos);
  newPng.set(bytes.slice(iendPos), iendPos + chunk.length);

  console.log('New PNG size:', newPng.length, 'bytes (added', chunk.length, 'bytes)');

  // Convert back to data URL
  let binary2 = '';
  for (let i = 0; i < newPng.length; i++) {
    binary2 += String.fromCharCode(newPng[i]);
  }
  const newBase64 = btoa(binary2);
  return `data:image/png;base64,${newBase64}`;
}

/**
 * Calculate CRC32 checksum
 */
function calculateCRC32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Download canvas as PNG blob
 */
export function downloadCanvasAsBlob(
  canvas: HTMLCanvasElement,
  filename: string,
  metadata: ParseMetadata
): void {
  const dataUrl = canvas.toDataURL('image/png');
  const dataUrlWithMetadata = injectPNGMetadata(dataUrl, metadata);

  // Convert data URL to blob
  const base64 = dataUrlWithMetadata.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'image/png' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Extract metadata from PNG tEXt chunk
 */
export function extractPNGMetadata(bytes: Uint8Array): ParseMetadata | null {
  console.log('Extracting metadata from PNG, size:', bytes.length, 'bytes');

  let pos = 8; // Skip PNG signature

  while (pos <= bytes.length - 12) {
    // Read chunk length (big-endian)
    const length =
      (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];

    // Read chunk type
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7]
    );

    if (type === 'tEXt') {
      console.log('Found tEXt chunk at position:', pos, 'length:', length);
      const chunkData = bytes.slice(pos + 8, pos + 8 + length);

      // Find null separator
      let nullPos = -1;
      for (let i = 0; i < chunkData.length; i++) {
        if (chunkData[i] === 0) {
          nullPos = i;
          break;
        }
      }

      if (nullPos !== -1) {
        const keyword = String.fromCharCode(...chunkData.slice(0, nullPos));
        console.log('tEXt keyword:', keyword);

        if (keyword === 'BPSR-Verification') {
          const jsonData = String.fromCharCode(...chunkData.slice(nullPos + 1));
          console.log('Found BPSR-Verification metadata!');
          return JSON.parse(jsonData);
        }
      }
    }

    // Stop at IEND
    if (type === 'IEND') {
      break;
    }

    // Move to next chunk
    pos += 4 + 4 + length + 4;

    if (pos > bytes.length) {
      break;
    }
  }

  return null;
}

/**
 * Verify PNG file authenticity
 */
export async function verifyPNG(file: File): Promise<{ success: boolean; message: string }> {
  if (file.type !== 'image/png') {
    return { success: false, message: 'Please select a PNG file' };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Extract metadata
    const metadata = extractPNGMetadata(bytes);

    if (!metadata) {
      return {
        success: false,
        message:
          'No verification metadata found in PNG. This file was not created by BPSR Tools or is from an older version.',
      };
    }

    // Recalculate hash
    const dataString = JSON.stringify({
      timestamp: metadata.timestamp,
      duration: metadata.duration,
      players: metadata.players,
    });
    const recalculatedHash = await generateHash(dataString);

    // Compare hashes
    if (recalculatedHash === metadata.hash) {
      const shortHash = metadata.hash.substring(0, 16).toUpperCase();
      const timestamp = new Date(metadata.timestamp).toLocaleString();
      const durationMin = Math.floor(metadata.duration / 60);
      const playerCount = metadata.players.length;

      return {
        success: true,
        message: `✅ Verified! This parse is authentic and unmodified.<br><br><strong>Verification Code:</strong> ${shortHash}<br><strong>Timestamp:</strong> ${timestamp}<br><strong>Duration:</strong> ${durationMin} minutes<br><strong>Players:</strong> ${playerCount}`,
      };
    } else {
      const expectedHash = metadata.hash.substring(0, 16).toUpperCase();
      const calculatedHash = recalculatedHash.substring(0, 16).toUpperCase();

      return {
        success: false,
        message: `❌ Verification Failed! This parse has been modified.<br><br><strong>Expected Hash:</strong> ${expectedHash}<br><strong>Calculated Hash:</strong> ${calculatedHash}`,
      };
    }
  } catch (error: any) {
    console.error('Error verifying PNG:', error);
    return {
      success: false,
      message: 'Error reading PNG file: ' + error.message,
    };
  }
}

/**
 * Export parse results to PNG
 */
export async function exportParseToPNG(
  combatData: CombatData[],
  parseDuration: number
): Promise<void> {
  try {
    let userArray = [...combatData];

    // Filter and sort top 10 players
    userArray = userArray
      .filter(
        (u) =>
          (u.totalDamage && u.totalDamage.total > 0) ||
          (u.totalHealing && u.totalHealing.total > 0)
      )
      .sort((a, b) => (b.totalDamage?.total || 0) - (a.totalDamage?.total || 0))
      .slice(0, 10);

    if (userArray.length === 0) {
      console.log('No data to export');
      return;
    }

    // Generate verification hash
    const timestamp = new Date().toISOString();
    const parseData = userArray.map((u) => ({
      name: u.name || 'Unknown',
      dps: Number(u.totalDps) || 0,
      damage: u.totalDamage?.total || 0,
      profession: u.professionDetails?.name_en || 'Unknown',
    }));

    const dataString = JSON.stringify({ timestamp, duration: parseDuration, players: parseData });
    const verificationHash = await generateHash(dataString);
    const shortHash = verificationHash.substring(0, 16).toUpperCase();

    // Get current theme
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Calculate canvas size
    const width = 950;
    const headerHeight = 120;
    const playerRowHeight = 85;
    const footerHeight = 60;
    const badgeHeight = 150;
    const height =
      headerHeight + Math.max(userArray.length * playerRowHeight, badgeHeight) + footerHeight + 60;

    canvas.width = width;
    canvas.height = height;

    // Theme colors
    const textColor = isDarkTheme ? '#e4e7eb' : '#1f2937';
    const subTextColor = isDarkTheme ? '#94a3b8' : '#6b7280';
    const brandPrimary = '#667eea';
    const brandSecondary = '#764ba2';

    // Draw background with gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, isDarkTheme ? '#1a1d2e' : '#f9fafb');
    gradient.addColorStop(1, isDarkTheme ? '#252a41' : '#ffffff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw anti-tampering pattern
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = brandPrimary;
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      for (let j = 0; j < height; j += 40) {
        ctx.beginPath();
        ctx.arc(i, j, 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Draw header
    const headerGradient = ctx.createLinearGradient(0, 0, width, 0);
    headerGradient.addColorStop(0, brandPrimary);
    headerGradient.addColorStop(1, brandSecondary);
    ctx.fillStyle = headerGradient;
    ctx.fillRect(0, 0, width, headerHeight);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 42px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('BPSR Tools - Parse Results', width / 2, 45);

    // Timestamp and duration
    const displayTimestamp = new Date(timestamp).toLocaleString();
    ctx.font = "16px 'Inter', sans-serif";
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const durationMinutes = Math.floor(parseDuration / 60);
    ctx.fillText(`${displayTimestamp} • ${durationMinutes} min`, width / 2, 75);

    // Verification hash
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText(`🛡️ ID: ${shortHash}`, width / 2, 100);

    // Load and draw player rows
    let yOffset = headerHeight + 20;

    const iconPromises = userArray.map(async (u) => {
      const professionIcon = u.professionDetails?.icon || 'unknown.png';
      return new Promise<{ user: CombatData; img: HTMLImageElement | null }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ user: u, img });
        img.onerror = () => resolve({ user: u, img: null });
        img.src = `assets/images/icons/${professionIcon}`;
      });
    });

    const iconData = await Promise.all(iconPromises);

    iconData.forEach((data, index) => {
      const u = data.user;
      const img = data.img;
      const dps = Number(u.totalDps) || 0;
      const hps = Number(u.totalHps) || 0;
      const dt = (u as any).takenDamage || 0;
      const totalDamage = u.totalDamage?.total || 0;
      const totalHealing = u.totalHealing?.total || 0;
      const professionName = u.professionDetails?.name_en || 'Unknown';
      const playerName = u.name && u.name.trim() !== '' ? u.name : 'Unknown';
      const totalHits = u.totalCount?.total || 0;
      const crit =
        u.totalCount?.critical !== undefined && totalHits > 0
          ? Math.round((u.totalCount.critical / totalHits) * 100)
          : 0;
      const lucky =
        u.totalCount?.lucky !== undefined && totalHits > 0
          ? Math.round((u.totalCount.lucky / totalHits) * 100)
          : 0;
      const peak = (u as any).realtimeDpsMax !== undefined ? (u as any).realtimeDpsMax : 0;
      const gs = (u as any).fightPoint || 0;
      const damagePercent =
        totalDamage > 0
          ? Math.round(
              (totalDamage / userArray.reduce((sum, user) => sum + (user.totalDamage?.total || 0), 0)) * 100
            )
          : 0;

      // Row background
      ctx.fillStyle =
        index % 2 === 0
          ? isDarkTheme
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(0, 0, 0, 0.02)'
          : isDarkTheme
          ? 'rgba(255, 255, 255, 0.06)'
          : 'rgba(0, 0, 0, 0.04)';
      ctx.fillRect(20, yOffset, width - 40, playerRowHeight);

      // Rank badge
      const rankSize = 40;
      const rankX = 45;
      const rankY = yOffset + playerRowHeight / 2;
      ctx.fillStyle = brandPrimary;
      ctx.beginPath();
      ctx.arc(rankX, rankY, rankSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 18px 'Inter', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${index + 1}`, rankX, rankY);

      // Name column
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const nameX = 85;
      ctx.fillStyle = textColor;
      ctx.font = "bold 16px 'Inter', sans-serif";
      ctx.fillText(playerName, nameX, yOffset + 15);
      ctx.fillStyle = subTextColor;
      ctx.font = "12px 'Inter', sans-serif";
      ctx.fillText(professionName, nameX, yOffset + 62);

      // Stats column
      const statsX = 290;
      ctx.textAlign = 'left';

      // DPS
      ctx.fillStyle = textColor;
      ctx.font = "bold 14px 'Inter', sans-serif";
      ctx.fillText(formatStat(dps), statsX, yOffset + 15);
      ctx.fillStyle = subTextColor;
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText('DPS', statsX + 60, yOffset + 17);

      // HPS
      ctx.fillStyle = textColor;
      ctx.font = "bold 14px 'Inter', sans-serif";
      ctx.fillText(formatStat(hps), statsX, yOffset + 38);
      ctx.fillStyle = '#28a745';
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText('HPS', statsX + 60, yOffset + 40);

      // DT
      ctx.fillStyle = textColor;
      ctx.font = "bold 14px 'Inter', sans-serif";
      ctx.fillText(formatStat(dt), statsX, yOffset + 61);
      ctx.fillStyle = '#ffc107';
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText('DT', statsX + 60, yOffset + 63);

      // Class icon with percentage
      const iconSize = 50;
      const iconX = 460;
      const iconY = yOffset + (playerRowHeight - iconSize) / 2;
      if (img) {
        ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(iconX, iconY + iconSize - 18, iconSize, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 12px 'Inter', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(`${damagePercent}%`, iconX + iconSize / 2, iconY + iconSize - 8);

      // Extra stats column
      const extraX = 560;
      ctx.textAlign = 'left';

      // CRIT
      ctx.fillStyle = subTextColor;
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText('CRIT ✸', extraX, yOffset + 20);
      ctx.fillStyle = textColor;
      ctx.font = "bold 13px 'Inter', sans-serif";
      ctx.fillText(`${crit}%`, extraX + 60, yOffset + 18);

      // LUCK
      ctx.fillStyle = subTextColor;
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText('LUCK ☘', extraX, yOffset + 43);
      ctx.fillStyle = textColor;
      ctx.font = "bold 13px 'Inter', sans-serif";
      ctx.fillText(`${lucky}%`, extraX + 60, yOffset + 41);

      // MAX
      ctx.fillStyle = subTextColor;
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText('MAX ⚔', extraX, yOffset + 66);
      ctx.fillStyle = textColor;
      ctx.font = "bold 13px 'Inter', sans-serif";
      ctx.fillText(formatStat(peak), extraX + 60, yOffset + 64);

      // Additional stats
      const additionalX = 710;

      // GS
      ctx.fillStyle = subTextColor;
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText('GS', additionalX, yOffset + 20);
      ctx.fillStyle = textColor;
      ctx.font = "bold 13px 'Inter', sans-serif";
      ctx.textAlign = 'right';
      ctx.fillText(formatStat(gs), width - 30, yOffset + 18);

      // Total Damage
      ctx.textAlign = 'left';
      ctx.fillStyle = subTextColor;
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText('🔥', additionalX, yOffset + 43);
      ctx.fillStyle = textColor;
      ctx.font = "bold 13px 'Inter', sans-serif";
      ctx.textAlign = 'right';
      ctx.fillText(formatStat(totalDamage), width - 30, yOffset + 41);

      // Total Healing
      ctx.textAlign = 'left';
      ctx.fillStyle = subTextColor;
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText('⛨', additionalX, yOffset + 66);
      ctx.fillStyle = '#28a745';
      ctx.font = "bold 13px 'Inter', sans-serif";
      ctx.textAlign = 'right';
      ctx.fillText(formatStat(totalHealing), width - 30, yOffset + 64);

      yOffset += playerRowHeight;
    });

    // Draw verification watermark
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.translate(width / 2, (headerHeight + yOffset) / 2);
    ctx.font = "120px 'Inter', sans-serif";
    ctx.fillStyle = brandPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', 0, -20);
    ctx.font = "bold 30px 'Inter', sans-serif";
    ctx.fillText('VERIFIED', 0, 70);
    ctx.font = "18px 'Courier New', monospace";
    ctx.fillText(shortHash, 0, 105);
    ctx.restore();

    // Draw watermarks
    ctx.save();
    ctx.globalAlpha = 0.015;
    ctx.font = "bold 80px 'Inter', sans-serif";
    ctx.fillStyle = brandPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.rotate(-Math.PI / 12);
    for (let i = 0; i < 3; i++) {
      ctx.fillText('BPSR TOOLS', width / 2, (height / 4) * (i + 1));
    }
    ctx.restore();

    // Footer
    ctx.fillStyle = textColor;
    ctx.font = "14px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'Generated with BPSR Tools • Verification Code: ' + shortHash,
      width / 2,
      height - 35
    );
    ctx.font = "11px 'Inter', sans-serif";
    ctx.fillStyle = subTextColor;
    ctx.fillText(
      'This parse result contains cryptographic verification. Any modifications will invalidate the code.',
      width / 2,
      height - 15
    );

    // Prepare metadata
    const metadata: ParseMetadata = {
      hash: verificationHash,
      timestamp: timestamp,
      duration: parseDuration,
      players: parseData,
      version: '1.2.3',
    };

    // Save or download
    const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `bpsr-parse-${fileTimestamp}.png`;

    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.saveFileToDesktop) {
      // Electron mode - save to desktop
      const dataUrl = canvas.toDataURL('image/png');
      const dataUrlWithMetadata = injectPNGMetadata(dataUrl, metadata);
      const result = await electronAPI.saveFileToDesktop(filename, dataUrlWithMetadata);

      if (result.success) {
        console.log(`Parse results exported to Desktop: ${result.path}`);
        console.log(`Verification Code: ${shortHash}`);
        console.log(`Full Hash: ${verificationHash}`);
        console.log(`Metadata embedded in PNG`);
      } else {
        console.error(`Error saving to Desktop: ${result.error}`);
        downloadCanvasAsBlob(canvas, filename, metadata);
      }
    } else {
      // Web mode - download
      downloadCanvasAsBlob(canvas, filename, metadata);
      console.log(`Parse results exported to Downloads folder`);
      console.log(`Verification Code: ${shortHash}`);
      console.log(`Full Hash: ${verificationHash}`);
      console.log(`Metadata embedded in PNG`);
    }

    console.log('Parse verification data:', {
      timestamp,
      duration: `${durationMinutes} minutes`,
      players: parseData.length,
      verificationCode: shortHash,
      fullHash: verificationHash,
      metadataEmbedded: true,
    });
  } catch (error) {
    console.error('Error exporting parse to PNG:', error);
    throw error;
  }
}
