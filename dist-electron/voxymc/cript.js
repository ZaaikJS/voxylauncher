"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayCode = getTodayCode;
exports.encryptPayload = encryptPayload;
const crypto_1 = __importDefault(require("crypto"));
const dailyCodes = [
    "DOM123", // Domingo
    "SEG234", // Segunda
    "TER345", // Terça
    "QUA456", // Quarta
    "QUI567", // Quinta
    "SEX678", // Sexta
    "SAB789" // Sábado
];
function getTodayCode() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "short"
    });
    const weekday = formatter.formatToParts(now).find(p => p.type === "weekday")?.value;
    const map = {
        dom: 0,
        seg: 1,
        ter: 2,
        qua: 3,
        qui: 4,
        sex: 5,
        sáb: 6,
        sab: 6
    };
    const index = map[weekday?.toLowerCase() || "dom"];
    return dailyCodes[index];
}
const secret = "aGVucmlxdWUtaGFycmlzb24tMjcvMDcvMjAwMy0xOS8wNC8xOTk5";
function deriveKey(password, salt) {
    return crypto_1.default.pbkdf2Sync(password, salt, 200000, 32, "sha256");
}
function encryptPayload(username, server, code) {
    const timestamp = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const payload = `voxy:${username}:${timestamp}:${server}`;
    const todayCode = getTodayCode();
    if (code !== todayCode) {
        return "null:null:null:null";
    }
    const salt = crypto_1.default.randomBytes(16);
    const key = deriveKey(secret, salt);
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
        cipher.update(payload, "utf8"),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    const hmac = crypto_1.default.createHmac("sha256", key);
    hmac.update(encrypted);
    const hash = hmac.digest();
    const saltBase64 = salt.toString("base64");
    const ivBase64 = iv.toString("base64");
    const tagBase64 = authTag.toString("base64");
    const encryptedBase64 = encrypted.toString("base64");
    const hashBase64 = hash.toString("base64");
    return `${saltBase64}:${ivBase64}:${tagBase64}:${encryptedBase64}:${hashBase64}`;
}
