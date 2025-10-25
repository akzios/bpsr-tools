const https = require('https');
const fs = require('fs');
const path = require('path');

// Profession mapping from professions.json
const professionMap = {
  'Stormblade': 1,
  'Frost Mage': 2,
  'Wind Knight': 3,
  'Verdant Oracle': 4,
  'Heavy Guardian': 5,
  'Marksman': 6,
  'Shield Knight': 7,
  'Soul Musician': 8,
};

function fetchPlayers() {
  return new Promise((resolve, reject) => {
    const url = 'https://blueprotocol.lunixx.de/index.php?action=recent&limit=1000000';

    console.log('[FetchPlayerSeed] Fetching player data from API...');

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok && json.recent) {
            console.log(`[FetchPlayerSeed] Fetched ${json.recent.length} players`);
            resolve(json.recent);
          } else {
            reject(new Error('Invalid API response'));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    // Fetch data from API
    const apiPlayers = await fetchPlayers();

    // Transform to seed format
    const players = apiPlayers.map(player => {
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
    const validPlayers = players.filter(p =>
      p.player_id &&
      p.name &&
      p.name !== 'Unknown' &&
      p.profession_id &&
      p.fight_point > 0
    );

    console.log(`[FetchPlayerSeed] Valid players: ${validPlayers.length} / ${players.length}`);

    // Create seed data structure
    const seedData = {
      players: validPlayers
    };

    // Save to seed file
    const seedPath = path.join(__dirname, '..', 'db', 'seed', 'players.json');
    fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2), 'utf8');

    console.log(`[FetchPlayerSeed] ✓ Saved ${validPlayers.length} players to ${seedPath}`);
    console.log(`[FetchPlayerSeed] File size: ${(fs.statSync(seedPath).size / 1024 / 1024).toFixed(2)} MB`);

    // Show profession distribution
    const professionCounts = {};
    validPlayers.forEach(p => {
      professionCounts[p.profession_id] = (professionCounts[p.profession_id] || 0) + 1;
    });

    console.log('\n[FetchPlayerSeed] Profession distribution:');
    Object.keys(professionMap).forEach(profName => {
      const id = professionMap[profName];
      const count = professionCounts[id] || 0;
      console.log(`  ${profName} (ID ${id}): ${count} players`);
    });

  } catch (error) {
    console.error('[FetchPlayerSeed] Error:', error.message);
    process.exit(1);
  }
}

main();
