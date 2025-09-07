"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientId = getClientId;
exports.getAccessToken = getAccessToken;
const keytar_1 = __importDefault(require("keytar"));
const node_machine_id_1 = require("node-machine-id");
async function getClientId() {
    const clientId = await (0, node_machine_id_1.machineId)();
    return clientId;
}
async function getAccessToken() {
    const accessToken = await keytar_1.default.getPassword('VoxyLauncher', 'token');
    return accessToken;
}
