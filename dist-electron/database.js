"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabases = initializeDatabases;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
let cacheDb;
let mainDb;
function initializeDatabases() {
    const basePath = path_1.default.join(electron_1.app.getPath('userData'));
    const cacheDbPath = path_1.default.join(basePath, "Data", "local");
    const mainDbPath = path_1.default.join(basePath, "Data", "main");
    fs_1.default.mkdirSync(path_1.default.dirname(cacheDbPath), { recursive: true });
    fs_1.default.mkdirSync(path_1.default.dirname(mainDbPath), { recursive: true });
    cacheDb = new better_sqlite3_1.default(cacheDbPath);
    mainDb = new better_sqlite3_1.default(mainDbPath);
}
function ensureTableExists(tableName) {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName))
        throw new Error("Invalid table name!");
    cacheDb.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}
function ensureMainTableExists(tableName) {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName))
        throw new Error("Invalid table name!");
    mainDb.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      value TEXT NOT NULL
    )
  `);
}
electron_1.ipcMain.handle("cacheDb:put", (async (_, table, key, value) => {
    ensureTableExists(table);
    cacheDb.prepare(`
    INSERT INTO ${table} (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value));
    return true;
}));
electron_1.ipcMain.handle("cacheDb:get", (async (_, table, key, subKey) => {
    ensureTableExists(table);
    const row = cacheDb.prepare(`SELECT value FROM ${table} WHERE key = ?`).get(key);
    if (row) {
        const data = JSON.parse(row.value);
        return subKey && typeof data === "object" ? data[subKey] : data;
    }
    return null;
}));
electron_1.ipcMain.handle("cacheDb:delete", (async (_, table, key) => {
    ensureTableExists(table);
    cacheDb.prepare(`DELETE FROM ${table} WHERE key = ?`).run(key);
    return true;
}));
electron_1.ipcMain.handle("cacheDb:update", (async (_, table, key, value) => {
    ensureTableExists(table);
    const result = cacheDb.prepare(`
    UPDATE ${table} SET value = ? WHERE key = ?
  `).run(JSON.stringify(value), key);
    return result.changes > 0;
}));
electron_1.ipcMain.handle("mainDb:insert", (async (_, table, key, value) => {
    ensureMainTableExists(table);
    mainDb.prepare(`
    INSERT INTO ${table} (key, value) VALUES (?, ?)
  `).run(key, JSON.stringify(value));
    return true;
}));
electron_1.ipcMain.handle("mainDb:get", (async (_, table, key) => {
    ensureMainTableExists(table);
    const row = mainDb.prepare(`SELECT value FROM ${table} WHERE key = ?`).get(key);
    return row ? JSON.parse(row.value) : null;
}));
electron_1.ipcMain.handle("mainDb:update", (async (_, table, key, value) => {
    ensureMainTableExists(table);
    mainDb.prepare(`
    UPDATE ${table} SET value = ? WHERE key = ?
  `).run(JSON.stringify(value), key);
    return true;
}));
electron_1.ipcMain.handle("mainDb:delete", (async (_, table, key) => {
    ensureMainTableExists(table);
    mainDb.prepare(`DELETE FROM ${table} WHERE key = ?`).run(key);
    return true;
}));
