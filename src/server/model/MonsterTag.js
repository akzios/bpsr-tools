const fs = require("fs");

class MonsterTagModel {
  constructor(logger, db) {
    this.logger = {
      info: (msg) => logger.info(`[MonsterTagDB] ${msg}`),
      error: (msg) => logger.error(`[MonsterTagDB] ${msg}`),
      warn: (msg) => logger.warn(`[MonsterTagDB] ${msg}`),
      debug: (msg) => logger.debug(`[MonsterTagDB] ${msg}`),
    };
    this.db = db;
    this.statements = {};
  }

  initialize() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS monster_tags (
          monster_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (monster_id, tag_id),
          FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_monster_tags_monster_id ON monster_tags(monster_id);
        CREATE INDEX IF NOT EXISTS idx_monster_tags_tag_id ON monster_tags(tag_id);
      `);

      this.statements.addTag = this.db.prepare(`
        INSERT OR IGNORE INTO monster_tags (monster_id, tag_id)
        VALUES (?, ?)
      `);
      this.statements.removeTag = this.db.prepare(`
        DELETE FROM monster_tags WHERE monster_id = ? AND tag_id = ?
      `);
      this.statements.getMonsterTags = this.db.prepare(`
        SELECT t.* FROM tags t
        JOIN monster_tags mt ON t.id = mt.tag_id
        WHERE mt.monster_id = ?
      `);
      this.statements.getTaggedMonsters = this.db.prepare(`
        SELECT m.* FROM monsters m
        JOIN monster_tags mt ON m.id = mt.monster_id
        WHERE mt.tag_id = ?
      `);
      this.statements.hasTag = this.db.prepare(`
        SELECT COUNT(*) as count FROM monster_tags
        WHERE monster_id = ? AND tag_id = ?
      `);

      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM monster_tags")
        .get();
      this.logger.info(
        `MonsterTag table initialized: ${count.count} relationships cached`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize monster_tags table: ${error.message}`,
      );
      throw error;
    }
  }

  loadFromJSON(jsonPath) {
    try {
      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM monster_tags")
        .get();
      if (count.count > 0) {
        this.logger.debug(
          "MonsterTag table already populated, skipping JSON load",
        );
        return;
      }

      if (!fs.existsSync(jsonPath)) {
        this.logger.warn(`MonsterTags JSON not found: ${jsonPath}`);
        return;
      }

      const data = fs.readFileSync(jsonPath, "utf8");
      const monsterTags = JSON.parse(data);

      const insert = this.db.transaction((monsterTags) => {
        for (const mt of monsterTags) {
          this.statements.addTag.run(mt.monster_id, mt.tag_id);
        }
      });

      insert(monsterTags);

      const newCount = this.db
        .prepare("SELECT COUNT(*) as count FROM monster_tags")
        .get();
      this.logger.info(
        `Loaded ${newCount.count} monster-tag relationships from JSON`,
      );
    } catch (error) {
      this.logger.error(
        `Error loading monster_tags from JSON: ${error.message}`,
      );
    }
  }

  addTag(monsterId, tagId) {
    try {
      const result = this.statements.addTag.run(monsterId, tagId);
      return result.changes > 0;
    } catch (error) {
      this.logger.error(
        `Error adding tag ${tagId} to monster ${monsterId}: ${error.message}`,
      );
      return false;
    }
  }

  removeTag(monsterId, tagId) {
    try {
      const result = this.statements.removeTag.run(monsterId, tagId);
      return result.changes > 0;
    } catch (error) {
      this.logger.error(
        `Error removing tag ${tagId} from monster ${monsterId}: ${error.message}`,
      );
      return false;
    }
  }

  getMonsterTags(monsterId) {
    try {
      return this.statements.getMonsterTags.all(monsterId);
    } catch (error) {
      this.logger.error(
        `Error getting tags for monster ${monsterId}: ${error.message}`,
      );
      return [];
    }
  }

  getTaggedMonsters(tagId) {
    try {
      return this.statements.getTaggedMonsters.all(tagId);
    } catch (error) {
      this.logger.error(
        `Error getting monsters with tag ${tagId}: ${error.message}`,
      );
      return [];
    }
  }

  hasTag(monsterId, tagId) {
    try {
      const result = this.statements.hasTag.get(monsterId, tagId);
      return result.count > 0;
    } catch (error) {
      this.logger.error(
        `Error checking tag ${tagId} for monster ${monsterId}: ${error.message}`,
      );
      return false;
    }
  }
}

module.exports = MonsterTagModel;
