"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
electron_1.ipcMain.handle('read-file', async (event, fileName) => {
    const filePath = path_1.default.join(electron_1.app.getPath('appData'), 'VoxyLauncherDev', fileName);
    try {
        fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
        const data = fs_1.default.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error('Erro ao ler o arquivo:', error);
        throw error;
    }
});
electron_1.ipcMain.handle('write-file', async (event, fileName, data) => {
    const filePath = path_1.default.join(electron_1.app.getPath('appData'), 'VoxyLauncherDev', fileName);
    try {
        fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    }
    catch (error) {
        console.error('Erro ao escrever no arquivo:', error);
        throw error;
    }
});
