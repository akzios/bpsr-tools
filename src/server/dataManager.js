const fsPromises = require("fs").promises;
const path = require("path");
const PlayerModel = require("./model/player");
const MonsterModel = require("./model/monster");
const SkillModel = require("./model/skill");
const ProfessionModel = require("./model/profession");
const PlayerAPIService = require("./playerAPIService");

class Lock {
  constructor() {
    this.queue = [];
    this.locked = false;
  }

  async acquire() {
    if (this.locked) {
      return new Promise((resolve) => this.queue.push(resolve));
    }
    this.locked = true;
  }

  release() {
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift();
      nextResolve();
    } else {
      this.locked = false;
    }
  }
}

function getSubProfessionBySkillId(skillId) {
  switch (skillId) {
    case 1241:
      return "射线";
    case 2307:
    case 2361:
    case 55302:
      return "协奏";
    case 20301:
      return "愈合";
    case 1518:
    case 1541:
    case 21402:
      return "惩戒";
    case 2306:
      return "狂音";
    case 120901:
    case 120902:
      return "冰矛";
    case 1714:
    case 1734:
      return "居合";
    case 44701:
    case 179906:
      return "月刃";
    case 220112:
    case 2203622:
      return "鹰弓";
    case 2292:
    case 1700820:
    case 1700825:
    case 1700827:
      return "狼弓";
    case 1419:
      return "空枪";
    case 1405:
    case 1418:
      return "重装";
    case 2405:
      return "防盾";
    case 2406:
      return "光盾";
    case 199902:
      return "岩盾";
    case 1930:
    case 1931:
    case 1934:
    case 1935:
      return "格挡";
    default:
      return "";
  }
}

/**
 * Normalize profession name by extracting parent class
 * Professions from packets may include specialization like "冰魔导师-冰柱"
 * We need to extract just the parent class "冰魔导师"
 * @param {string} profession - Profession name (may include specialization)
 * @returns {string} - Parent profession name
 */
function normalizeParentProfession(profession) {
  if (!profession || profession?.toLowerCase() === "unknown") {
    return profession;
  }

  // If profession contains hyphen, extract parent class (everything before -)
  if (profession.includes("-")) {
    return profession.split("-")[0].trim();
  }

  return profession;
}

class StatisticData {
  constructor(user, type, element) {
    this.user = user;
    this.type = type || "";
    this.element = element || "";
    this.stats = {
      normal: 0,
      critical: 0,
      lucky: 0,
      crit_lucky: 0,
      hpLessen: 0,
      total: 0,
    };
    this.count = {
      normal: 0,
      critical: 0,
      lucky: 0,
      crit_lucky: 0,
      total: 0,
    };
    this.realtimeWindow = [];
    this.timeRange = [];
    this.realtimeStats = {
      value: 0,
      max: 0,
    };
  }

  /** Add data record
   * @param {number} value - Value
   * @param {boolean} isCrit - Whether it's a critical hit
   * @param {boolean} isLucky - Whether it's a lucky hit
   * @param {number} hpLessenValue - HP reduction amount (used for damage only)
   */
  addRecord(value, isCrit, isLucky, hpLessenValue = 0) {
    const now = Date.now();

    if (isCrit) {
      if (isLucky) {
        this.stats.crit_lucky += value;
      } else {
        this.stats.critical += value;
      }
    } else if (isLucky) {
      this.stats.lucky += value;
    } else {
      this.stats.normal += value;
    }
    this.stats.total += value;
    this.stats.hpLessen += hpLessenValue;

    if (isCrit) {
      this.count.critical++;
    }
    if (isLucky) {
      this.count.lucky++;
    }
    if (!isCrit && !isLucky) {
      this.count.normal++;
    }
    if (isCrit && isLucky) {
      this.count.crit_lucky++;
    }
    this.count.total++;

    this.realtimeWindow.push({
      time: now,
      value,
    });

    if (this.timeRange[0]) {
      this.timeRange[1] = now;
    } else {
      this.timeRange[0] = now;
    }
  }

  updateRealtimeStats() {
    const now = Date.now();

    while (
      this.realtimeWindow.length > 0 &&
      now - this.realtimeWindow[0].time > 1000
    ) {
      this.realtimeWindow.shift();
    }

    this.realtimeStats.value = 0;
    for (const entry of this.realtimeWindow) {
      this.realtimeStats.value += entry.value;
    }
    if (this.realtimeStats.value > this.realtimeStats.max) {
      this.realtimeStats.max = this.realtimeStats.value;
    }
  }

  getTotalPerSecond() {
    if (!this.timeRange[0] || !this.timeRange[1]) {
      return 0;
    }
    const totalPerSecond =
      (this.stats.total / (this.timeRange[1] - this.timeRange[0])) * 1000 || 0;
    if (!Number.isFinite(totalPerSecond)) return 0;
    return totalPerSecond;
  }

  reset() {
    this.stats = {
      normal: 0,
      critical: 0,
      lucky: 0,
      crit_lucky: 0,
      hpLessen: 0,
      total: 0,
    };
    this.count = {
      normal: 0,
      critical: 0,
      lucky: 0,
      crit_lucky: 0,
      total: 0,
    };
    this.realtimeWindow = [];
    this.timeRange = [];
    this.realtimeStats = {
      value: 0,
      max: 0,
    };
  }
}

class UserData {
  constructor(uid) {
    this.uid = uid;
    this.name = "";
    this.damageStats = new StatisticData(this, "damage");
    this.healingStats = new StatisticData(this, "healing");
    this.takenDamage = 0;
    this.deadCount = 0;
    this.profession = "Unknown";
    this.skillUsage = new Map();
    this.fightPoint = 0;
    this.subProfession = "";
    this.attr = {};
  }

  /** Add damage record
   * @param {number} skillId - Skill ID/Buff ID
   * @param {string} element - Skill element property
   * @param {number} damage - Damage value
   * @param {boolean} isCrit - Whether it's a critical hit
   * @param {boolean} [isLucky] - Whether it's lucky
   * @param {boolean} [isCauseLucky] - Whether it causes lucky
   * @param {number} hpLessenValue - HP reduction amount
   */
  addDamage(
    skillId,
    element,
    damage,
    isCrit,
    isLucky,
    isCauseLucky,
    hpLessenValue = 0,
  ) {
    this.damageStats.addRecord(damage, isCrit, isLucky, hpLessenValue);
    if (!this.skillUsage.has(skillId)) {
      this.skillUsage.set(skillId, new StatisticData(this, "damage", element));
    }
    this.skillUsage
      .get(skillId)
      .addRecord(damage, isCrit, isCauseLucky, hpLessenValue);
    this.skillUsage.get(skillId).realtimeWindow.length = 0;

    const subProfession = getSubProfessionBySkillId(skillId);
    if (subProfession) {
      this.setSubProfession(subProfession);
    }
  }

  /** Add healing record
   * @param {number} skillId - Skill ID/Buff ID
   * @param {string} element - Skill element property
   * @param {number} healing - Healing value
   * @param {boolean} isCrit - Whether it's a critical hit
   * @param {boolean} [isLucky] - Whether it's lucky
   * @param {boolean} [isCauseLucky] - Whether it causes lucky
   */
  addHealing(skillId, element, healing, isCrit, isLucky, isCauseLucky) {
    this.healingStats.addRecord(healing, isCrit, isLucky);
    // Record skill usage
    skillId = skillId + 1000000000;
    if (!this.skillUsage.has(skillId)) {
      this.skillUsage.set(skillId, new StatisticData(this, "healing", element));
    }
    this.skillUsage.get(skillId).addRecord(healing, isCrit, isCauseLucky);
    this.skillUsage.get(skillId).realtimeWindow.length = 0;

    const subProfession = getSubProfessionBySkillId(skillId - 1000000000);
    if (subProfession) {
      this.setSubProfession(subProfession);
    }
  }

  /** Add damage taken record
   * @param {number} damage - Damage value taken
   * @param {boolean} isDead - Whether it's fatal damage
   * */
  addTakenDamage(damage, isDead) {
    this.takenDamage += damage;
    if (isDead) this.deadCount++;
  }

  updateRealtimeDps() {
    this.damageStats.updateRealtimeStats();
    this.healingStats.updateRealtimeStats();
  }

  getTotalDps() {
    return this.damageStats.getTotalPerSecond();
  }

  getTotalHps() {
    return this.healingStats.getTotalPerSecond();
  }

  getTotalCount() {
    return {
      normal: this.damageStats.count.normal + this.healingStats.count.normal,
      critical:
        this.damageStats.count.critical + this.healingStats.count.critical,
      lucky: this.damageStats.count.lucky + this.healingStats.count.lucky,
      crit_lucky:
        this.damageStats.count.crit_lucky + this.healingStats.count.crit_lucky,
      total: this.damageStats.count.total + this.healingStats.count.total,
    };
  }

  getSummary() {
    return {
      uid: this.uid,
      realtime_dps: this.damageStats.realtimeStats.value,
      realtime_dps_max: this.damageStats.realtimeStats.max,
      total_dps: this.getTotalDps(),
      total_damage: { ...this.damageStats.stats },
      total_count: this.getTotalCount(),
      realtime_hps: this.healingStats.realtimeStats.value,
      realtime_hps_max: this.healingStats.realtimeStats.max,
      total_hps: this.getTotalHps(),
      total_healing: { ...this.healingStats.stats },
      taken_damage: this.takenDamage,
      profession:
        this.profession + (this.subProfession ? `-${this.subProfession}` : ""),
      name: this.name,
      fightPoint: this.fightPoint,
      hp: this.attr.hp,
      max_hp: this.attr.max_hp,
      dead_count: this.deadCount,
    };
  }

  getSkillSummary() {
    const skills = {};
    for (const [skillId, stat] of this.skillUsage) {
      const total =
        stat.stats.normal +
        stat.stats.critical +
        stat.stats.lucky +
        stat.stats.crit_lucky;
      const critCount = stat.count.critical;
      const luckyCount = stat.count.lucky;
      const critRate = stat.count.total > 0 ? critCount / stat.count.total : 0;
      const luckyRate =
        stat.count.total > 0 ? luckyCount / stat.count.total : 0;
      // Get skill name from database (prefers English, falls back to Chinese)
      const skillIdKey = skillId % 1000000000;
      const name = this.skillDb?.getSkillName(skillIdKey) ?? String(skillIdKey);
      const elementype = stat.element;

      skills[skillId] = {
        displayName: name,
        type: stat.type,
        elementype: elementype,
        totalDamage: stat.stats.total,
        totalCount: stat.count.total,
        critCount: stat.count.critical,
        luckyCount: stat.count.lucky,
        critRate: critRate,
        luckyRate: luckyRate,
        damageBreakdown: { ...stat.stats },
        countBreakdown: { ...stat.count },
      };
    }
    return skills;
  }

  /** 设置职业
   * @param {string} profession - 职业名称
   * */
  setProfession(profession) {
    if (profession !== this.profession) this.setSubProfession("");
    this.profession = profession;
  }

  /** 设置子职业
   * @param {string} subProfession - 子职业名称
   * */
  setSubProfession(subProfession) {
    this.subProfession = subProfession;
  }

  /** 设置姓名
   * @param {string} name - 姓名
   * */
  setName(name) {
    this.name = name;
  }

  /** 设置用户总评分
   * @param {number} fightPoint - 总评分
   */
  setFightPoint(fightPoint) {
    this.fightPoint = fightPoint;
  }

  /** 设置额外数据
   * @param {string} key
   * @param {any} value
   */
  setAttrKV(key, value) {
    this.attr[key] = value;
  }

  /** 重置数据 预留 */
  reset() {
    this.damageStats.reset();
    this.healingStats.reset();
    this.takenDamage = 0;
    this.skillUsage.clear();
    this.fightPoint = 0;
  }
}

class UserDataManager {
  constructor(logger, globalSettings, version = "1.0.0") {
    // Wrap logger with [DataManager] prefix
    this.logger = {
      info: (msg) => logger.info(`[DataManager] ${msg}`),
      error: (msg) => logger.error(`[DataManager] ${msg}`),
      warn: (msg) => logger.warn(`[DataManager] ${msg}`),
      debug: (msg) => logger.debug(`[DataManager] ${msg}`),
    };
    this.globalSettings = globalSettings; // Almacenar globalSettings
    this.version = version; // Store version for history logs
    this.users = new Map();
    this.userCache = new Map(); // Mantener userCache para cargar nombres y fightPoint

    this.hpCache = new Map();
    this.startTime = Date.now();

    this.logLock = new Lock();
    this.logDirExist = new Set();

    this.enemyCache = {
      name: new Map(),
      hp: new Map(),
      maxHp: new Map(),
    };

    this.localPlayerUid = null; // Track the current player's UID

    // Initialize player database
    this.playerDb = new PlayerModel(logger);
    this.monsterDb = null; // Will be initialized in initialize()
    this.skillDb = null; // Will be initialized in initialize()
    this.professionDb = null; // Will be initialized in initialize()

    // Initialize player API service
    this.playerAPI = new PlayerAPIService(logger);
  }

  async initialize() {
    // Initialize player database (creates DB connection and players table)
    this.playerDb.initialize();

    // Initialize profession database FIRST (players table has FK to professions)
    this.professionDb = new ProfessionModel(this.logger, this.playerDb.getDB());
    this.professionDb.initialize();

    // Now prepare player statements (requires professions table to exist for JOIN)
    this.playerDb.prepareStatements();

    // Initialize monster database
    this.monsterDb = new MonsterModel(this.logger, this.playerDb.getDB());
    this.monsterDb.initialize();

    // Initialize skill database
    this.skillDb = new SkillModel(this.logger, this.playerDb.getDB());
    this.skillDb.initialize();
  }

  /** Set the local player UID
   * @param {number} uid - Local player's UID
   */
  setLocalPlayer(uid) {
    this.localPlayerUid = uid;
    this.logger.info(`Local player UID set to: ${uid}`);
  }
  /** Get or create user
   * @param {number} uid - User ID
   * @returns {UserData} - User data instance
   */
  getUser(uid) {
    if (!this.users.has(uid)) {
      const user = new UserData(uid);
      const uidStr = String(uid);

      // Load from database
      const cachedPlayer = this.playerDb.getPlayer(uidStr);
      if (cachedPlayer) {
        if (cachedPlayer.name) {
          user.setName(cachedPlayer.name);
        }
        if (cachedPlayer.profession) {
          user.setProfession(cachedPlayer.profession);
        }
        if (cachedPlayer.fight_point) {
          user.setFightPoint(cachedPlayer.fight_point);
        }
        if (cachedPlayer.max_hp) {
          user.setAttrKV("max_hp", cachedPlayer.max_hp);
        }
      }

      // Also check old userCache for compatibility
      const cachedData = this.userCache.get(uidStr);
      if (cachedData) {
        if (cachedData.name && !user.name) {
          user.setName(cachedData.name);
        }
        if (
          cachedData.fightPoint !== undefined &&
          cachedData.fightPoint !== null &&
          !user.fightPoint
        ) {
          user.setFightPoint(cachedData.fightPoint);
        }
        if (
          cachedData.maxHp !== undefined &&
          cachedData.maxHp !== null &&
          !user.attr.max_hp
        ) {
          user.setAttrKV("max_hp", cachedData.maxHp);
        }
      }

      if (this.hpCache.has(uid)) {
        user.setAttrKV("hp", this.hpCache.get(uid));
      }

      this.users.set(uid, user);

      // Fetch from API if name, fight point, or profession is missing (async, non-blocking)
      if (!user.name || !user.fightPoint || user.profession?.toLowerCase() === "unknown") {
        this.fetchAndUpdatePlayerData(uid, user);
      }
    }
    return this.users.get(uid);
  }

  /** Fetch player data from API and update user object
   * @param {number} uid - Player ID
   * @param {UserData} user - User data instance
   */
  async fetchAndUpdatePlayerData(uid, user) {
    try {
      const playerData = await this.playerAPI.fetchPlayerData(uid);

      if (playerData) {
        // Update name if missing
        if (!user.name && playerData.name) {
          this.setName(uid, playerData.name);
          this.logger.info(
            `Updated player name from API: ${playerData.name} (UID ${uid})`,
          );
        }

        // Update fight point if missing
        if (!user.fightPoint && playerData.fightPoint) {
          this.setFightPoint(uid, playerData.fightPoint);
          this.logger.info(
            `Updated fight point from API: ${playerData.fightPoint} (UID ${uid})`,
          );
        }

        // Update profession if missing
        if (
          user.profession?.toLowerCase() === "unknown" &&
          playerData.profession &&
          playerData.profession?.toLowerCase() !== "unknown"
        ) {
          this.setProfession(uid, playerData.profession);
          this.logger.info(
            `Updated profession from API: ${playerData.profession} (UID ${uid})`,
          );
        }

        // Update max HP if missing
        if (!user.attr.max_hp && playerData.max_hp) {
          user.setAttrKV("max_hp", playerData.max_hp);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error fetching player data from API for UID ${uid}: ${error.message}`,
      );
    }
  }

  /** Add damage record
   * @param {number} uid - ID of user dealing damage
   * @param {number} skillId - Skill/Buff ID
   * @param {string} element - Skill element attribute
   * @param {number} damage - Damage value
   * @param {boolean} isCrit - Whether it's critical
   * @param {boolean} [isLucky] - Whether it's lucky
   * @param {boolean} [isCauseLucky] - Whether it causes lucky
   * @param {number} hpLessenValue - Actual HP reduction
   * @param {number} targetUid - ID of damage target
   */
  addDamage(
    uid,
    skillId,
    element,
    damage,
    isCrit,
    isLucky,
    isCauseLucky,
    hpLessenValue = 0,
    targetUid,
  ) {
    // isPaused and globalSettings.onlyRecordEliteDummy will be handled in sniffer or entry point
    this.checkTimeoutClear();
    const user = this.getUser(uid);
    user.addDamage(
      skillId,
      element,
      damage,
      isCrit,
      isLucky,
      isCauseLucky,
      hpLessenValue,
    );
  }

  /** Add healing record
   * @param {number} uid - ID of user performing healing
   * @param {number} skillId - Skill/Buff ID
   * @param {string} element - Skill element attribute
   * @param {number} healing - Healing value
   * @param {boolean} isCrit - Whether it's critical
   * @param {boolean} [isLucky] - Whether it's lucky
   * @param {boolean} [isCauseLucky] - Whether it causes lucky
   * @param {number} targetUid - ID of healing target
   */
  addHealing(
    uid,
    skillId,
    element,
    healing,
    isCrit,
    isLucky,
    isCauseLucky,
    targetUid,
  ) {
    // isPaused will be handled in sniffer or entry point
    this.checkTimeoutClear();
    if (uid !== 0) {
      const user = this.getUser(uid);
      user.addHealing(skillId, element, healing, isCrit, isLucky, isCauseLucky);
    }
  }

  /** Add damage taken record
   * @param {number} uid - ID of user receiving damage
   * @param {number} damage - Damage value received
   * @param {boolean} isDead - Whether it's lethal damage
   * */
  addTakenDamage(uid, damage, isDead) {
    // isPaused will be handled in sniffer or entry point
    this.checkTimeoutClear();
    const user = this.getUser(uid);
    user.addTakenDamage(damage, isDead);
  }

  /** Agregar registro de log
   * @param {string} log - Contenido del log
   * */
  async addLog(log) {
    if (!this.globalSettings.enableFightLog) return;

    const logDir = path.join("./logs", String(this.startTime));
    const logFile = path.join(logDir, "fight.log");
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${log}\n`;

    await this.logLock.acquire();
    try {
      if (!this.logDirExist.has(logDir)) {
        try {
          await fsPromises.access(logDir);
        } catch (error) {
          await fsPromises.mkdir(logDir, { recursive: true });
        }
        this.logDirExist.add(logDir);
      }
      await fsPromises.appendFile(logFile, logEntry, "utf8");
    } catch (error) {
      this.logger.error("Failed to save log:", error);
    }
    this.logLock.release();
  }

  /** Set user profession
   * @param {number} uid - User ID
   * @param {string} profession - Profession name
   * */
  setProfession(uid, profession) {
    const user = this.getUser(uid);

    // Normalize profession to extract parent class
    const normalizedProfession = normalizeParentProfession(profession);

    if (user.profession !== normalizedProfession) {
      user.setProfession(normalizedProfession);
      this.logger.info(`Found profession ${normalizedProfession} for uid ${uid}${profession !== normalizedProfession ? ` (normalized from ${profession})` : ''}`);

      // Save to database
      this.playerDb.savePlayer({
        player_id: uid,
        name: user.name || null,
        profession: normalizedProfession,
        fight_point: user.fightPoint || 0,
        max_hp: user.attr.max_hp || null,
        player_level: null,
      });
    }
  }

  /** Set user name
   * @param {number} uid - User ID
   * @param {string} name - Name
   * */
  setName(uid, name) {
    const user = this.getUser(uid);

    // Never save placeholder names
    if (!name || name === "" || name === "You" || name?.toLowerCase() === "unknown") {
      return;
    }

    if (user.name !== name) {
      user.setName(name);
      this.logger.info(`Found player name ${name} for uid ${uid}`);

      // Save to database
      this.playerDb.savePlayer({
        player_id: uid,
        name: name,
        profession: user.profession?.toLowerCase() !== "unknown" ? user.profession : null,
        fight_point: user.fightPoint || 0,
        max_hp: user.attr.max_hp || null,
        player_level: null,
      });
    }
  }

  /** Set user fight score
   * @param {number} uid - User ID
   * @param {number} fightPoint - Fight score
   */
  setFightPoint(uid, fightPoint) {
    const user = this.getUser(uid);

    // Warn if trying to set to 0 when we have a non-zero value
    if (fightPoint === 0 && user.fightPoint > 0) {
      this.logger.warn(
        `Attempted to set gear score to 0 for uid ${uid} (current: ${user.fightPoint}) - IGNORING`,
      );
      return; // Don't allow setting to 0 if we have a valid value
    }

    // Only update if:
    // 1. Current value is 0 or unset (initial set)
    // 2. New value is higher (gear upgrade)
    // Don't allow downgrading unless current is 0
    if (
      user.fightPoint === 0 ||
      !user.fightPoint ||
      fightPoint > user.fightPoint
    ) {
      if (user.fightPoint != fightPoint) {
        user.setFightPoint(fightPoint);
        this.logger.info(
          `Found fight point ${fightPoint} for uid ${uid} (was: ${user.fightPoint || 0})`,
        );

        // Save to database
        this.playerDb.savePlayer({
          player_id: uid,
          name: user.name || null,
          profession: user.profession?.toLowerCase() !== "unknown" ? user.profession : null,
          fight_point: fightPoint,
          max_hp: user.attr.max_hp || null,
          player_level: null,
        });
      }
    } else if (fightPoint < user.fightPoint && fightPoint !== 0) {
      // Log when we're ignoring a lower value (possible gear change)
      this.logger.debug(
        `Ignoring lower fight point ${fightPoint} for uid ${uid} (current: ${user.fightPoint})`,
      );
    }
  }

  /** Set additional data
   * @param {number} uid - User ID
   * @param {string} key
   * @param {any} value
   */
  setAttrKV(uid, key, value) {
    const user = this.getUser(uid);
    user.attr[key] = value;
  }

  /** Update real-time DPS and HPS for all users */
  updateAllRealtimeDps() {
    for (const user of this.users.values()) {
      user.updateRealtimeDps();
    }
  }

  /** Get user skill data
   * @param {number} uid - User ID
   */
  getUserSkillData(uid) {
    const user = this.users.get(uid);
    if (!user) return null;

    // Get profession details (works with both Chinese and English names)
    const mainClass = user.profession ? user.profession.split(/\s*[-·]\s*/)[0].trim() : null;
    const professionDetails = mainClass ? this.professionDb.getByName(mainClass) : null;

    return {
      uid: user.uid,
      name: user.name,
      professionDetails: professionDetails || {
        name_cn: mainClass || "Unknown",
        name_en: mainClass || "Unknown",
        icon: "unknown.png",
        role: "dps"
      },
      skills: user.getSkillSummary(),
      attr: user.attr,
    };
  }

  /** Get all user data */
  getAllUsersData() {
    const result = {};
    for (const [uid, user] of this.users.entries()) {
      const isLocal = uid === this.localPlayerUid;

      // Skip users without names
      if (!user.name || user.name === "") {
        continue;
      }

      const userData = user.getSummary();

      result[uid] = {
        ...userData,
        isLocalPlayer: isLocal, // Flag for current player
      };
    }
    return result;
  }

  /** Get all enemy cache data */
  getAllEnemiesData() {
    const result = {};
    const enemyIds = new Set([
      ...this.enemyCache.name.keys(),
      ...this.enemyCache.hp.keys(),
      ...this.enemyCache.maxHp.keys(),
    ]);
    enemyIds.forEach((id) => {
      result[id] = {
        name: this.enemyCache.name.get(id),
        hp: this.enemyCache.hp.get(id),
        max_hp: this.enemyCache.maxHp.get(id),
      };
    });
    return result;
  }

  /** Clear enemy cache */
  refreshEnemyCache() {
    this.enemyCache.name.clear();
    this.enemyCache.hp.clear();
    this.enemyCache.maxHp.clear();
  }

  /** Clear all user data */
  clearAll() {
    this.users = new Map();
    this.startTime = Date.now();
  }

  /** Get user ID list */
  getUserIds() {
    return Array.from(this.users.keys());
  }

  /** Save all user data to history
   * @param {Map} usersToSave - Map of user data to save
   * @param {number} startTime - Data start time
   */
  async saveAllUserData(usersToSave = null, startTime = null) {
    if (!this.globalSettings.enableHistorySave) return; // Don't save history if setting is disabled

    try {
      const endTime = Date.now();
      const users = usersToSave || this.users;
      const timestamp = startTime || this.startTime;
      const logDir = path.join("./logs", String(timestamp));
      const usersDir = path.join(logDir, "users");
      const summary = {
        startTime: timestamp,
        endTime,
        duration: endTime - timestamp,
        userCount: users.size,
        version: this.version,
      };

      const allUsersData = {};
      const userDatas = new Map();
      for (const [uid, user] of users.entries()) {
        allUsersData[uid] = user.getSummary();

        const userData = {
          uid: user.uid,
          name: user.name,
          profession:
            user.profession +
            (user.subProfession ? `-${user.subProfession}` : ""),
          skills: user.getSkillSummary(),
          attr: user.attr,
        };
        userDatas.set(uid, userData);
      }

      try {
        await fsPromises.access(usersDir);
      } catch (error) {
        await fsPromises.mkdir(usersDir, { recursive: true });
      }

      // Save summary of all user data
      const allUserDataPath = path.join(logDir, "allUserData.json");
      await fsPromises.writeFile(
        allUserDataPath,
        JSON.stringify(allUsersData, null, 2),
        "utf8",
      );

      // Save detailed data for each user
      for (const [uid, userData] of userDatas.entries()) {
        const userDataPath = path.join(usersDir, `${uid}.json`);
        await fsPromises.writeFile(
          userDataPath,
          JSON.stringify(userData, null, 2),
          "utf8",
        );
      }

      await fsPromises.writeFile(
        path.join(logDir, "summary.json"),
        JSON.stringify(summary, null, 2),
        "utf8",
      );

      this.logger.debug(
        `Saved data for ${summary.userCount} users to ${logDir}`,
      );
    } catch (error) {
      this.logger.error("Failed to save all user data:", error);
      throw error;
    }
  }

  checkTimeoutClear() {
    if (!this.globalSettings.autoClearOnTimeout || this.users.size === 0)
      return;
    const currentTime = Date.now();
    if (this.lastLogTime && currentTime - this.lastLogTime > 20000) {
      this.clearAll();
      this.logger.info("Timeout reached, statistics cleared!");
    }
  }
}

module.exports = {
  StatisticData,
  UserData,
  UserDataManager,
  Lock,
};
