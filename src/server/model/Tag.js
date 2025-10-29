const fs = require("fs");

class TagModel {
  constructor(logger, db) {
    this.logger = {
      info: (msg) => logger.info(`[TagDB] ${msg}`),
      error: (msg) => logger.error(`[TagDB] ${msg}`),
      warn: (msg) => logger.warn(`[TagDB] ${msg}`),
      debug: (msg) => logger.debug(`[TagDB] ${msg}`),
    };
    this.db = db;
    this.statements = {};
  }

  initialize() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          tag_type INTEGER,
          parent_tag INTEGER,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_tags_tag_type ON tags(tag_type);
        CREATE INDEX IF NOT EXISTS idx_tags_parent_tag ON tags(parent_tag);
      `);

      this.statements.getTag = this.db.prepare(
        "SELECT * FROM tags WHERE id = ?",
      );
      this.statements.insertTag = this.db.prepare(`
        INSERT OR REPLACE INTO tags (id, name, description, tag_type, parent_tag)
        VALUES (?, ?, ?, ?, ?)
      `);
      this.statements.getAllTags = this.db.prepare("SELECT * FROM tags");
      this.statements.getTagsByType = this.db.prepare(
        "SELECT * FROM tags WHERE tag_type = ?",
      );

      const count = this.db.prepare("SELECT COUNT(*) as count FROM tags").get();
      this.logger.info(`Tag table initialized: ${count.count} tags cached`);
    } catch (error) {
      this.logger.error(`Failed to initialize tag table: ${error.message}`);
      throw error;
    }
  }

  loadFromJSON(jsonPath) {
    try {
      const count = this.db.prepare("SELECT COUNT(*) as count FROM tags").get();
      if (count.count > 0) {
        this.logger.debug("Tag table already populated, skipping JSON load");
        return;
      }

      if (!fs.existsSync(jsonPath)) {
        this.logger.warn(`Tags JSON not found: ${jsonPath}`);
        return;
      }

      const data = fs.readFileSync(jsonPath, "utf8");
      const tags = JSON.parse(data);

      const insert = this.db.transaction((tags) => {
        for (const tag of Object.values(tags)) {
          this.statements.insertTag.run(
            tag.id,
            tag.name,
            tag.description,
            tag.tag_type,
            tag.parent_tag,
          );
        }
      });

      insert(tags);

      const newCount = this.db
        .prepare("SELECT COUNT(*) as count FROM tags")
        .get();
      this.logger.info(`Loaded ${newCount.count} tags from JSON into database`);
    } catch (error) {
      this.logger.error(`Error loading tags from JSON: ${error.message}`);
    }
  }

  getTag(tagId) {
    try {
      const id = parseInt(tagId);
      if (isNaN(id)) {
        this.logger.warn(`Invalid tag ID: ${tagId}`);
        return null;
      }
      return this.statements.getTag.get(id);
    } catch (error) {
      this.logger.error(`Error getting tag ${tagId}: ${error.message}`);
      return null;
    }
  }

  getAllTags() {
    try {
      return this.statements.getAllTags.all();
    } catch (error) {
      this.logger.error(`Error getting all tags: ${error.message}`);
      return [];
    }
  }

  getTagsByType(tagType) {
    try {
      return this.statements.getTagsByType.all(tagType);
    } catch (error) {
      this.logger.error(
        `Error getting tags by type ${tagType}: ${error.message}`,
      );
      return [];
    }
  }

  saveTag(id, name, description, tagType, parentTag = null) {
    try {
      const tagId = parseInt(id);
      if (isNaN(tagId) || !name) {
        this.logger.warn(`Cannot save tag: invalid id (${id}) or missing name`);
        return false;
      }

      this.statements.insertTag.run(
        tagId,
        name,
        description,
        tagType,
        parentTag,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error saving tag ${id}: ${error.message}`);
      return false;
    }
  }
}

module.exports = TagModel;
