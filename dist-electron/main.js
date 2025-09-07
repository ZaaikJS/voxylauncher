"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const { shell } = require('electron');
require("./voxymc/launchMinecraft");
require("./database");
require("./fileHandler");
const database_1 = require("./database");
const client_1 = require("./client");
const keytar_1 = __importDefault(require("keytar"));
const crypto_1 = require("crypto");
let mainWindow = null;
let logWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1280,
        minHeight: 720,
        icon: path_1.default.join(__dirname, "../public", "icon.ico"),
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, 'index.html'));
        mainWindow.webContents.openDevTools();
    }
    electron_1.ipcMain.on('minimize-window', () => mainWindow?.minimize());
    electron_1.ipcMain.on('maximize-window', () => {
        if (mainWindow?.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow?.maximize();
    });
    electron_1.ipcMain.on('close-window', () => mainWindow?.close());
    electron_1.ipcMain.handle('open-link', async (_, url) => shell.openExternal(url));
}
function createLogWindow() {
    if (logWindow) {
        logWindow.focus();
        return;
    }
    logWindow = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        title: "Console do Minecraft",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, "preload.js"),
        },
    });
    if (process.env.NODE_ENV === "development") {
        logWindow.loadURL("http://localhost:5173/#/console");
    }
    else {
        logWindow.loadFile(path_1.default.join(__dirname, "../dist/index.html"), { hash: "console" });
    }
    logWindow.on("closed", () => { logWindow = null; });
}
// Variável para guardar URL passada na inicialização
let deeplinkingUrl = null;
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', (event, argv) => {
        const url = argv.find(arg => arg.startsWith('voxy://'));
        if (url && mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
            mainWindow.webContents.send('uri', url);
        }
    });
    electron_1.app.whenReady().then(async () => {
        if (process.defaultApp && process.argv.length >= 2) {
            electron_1.app.setAsDefaultProtocolClient('voxy', process.execPath, [path_1.default.resolve(process.argv[1])]);
        }
        else {
            electron_1.app.setAsDefaultProtocolClient('voxy');
        }
        (0, database_1.initializeDatabases)();
        createWindow();
        const args = process.argv;
        const uriArg = args.find(arg => arg.startsWith('voxy://'));
        if (uriArg) {
            deeplinkingUrl = uriArg;
        }
        mainWindow?.webContents.once('did-finish-load', () => {
            if (deeplinkingUrl) {
                mainWindow?.webContents.send('uri', deeplinkingUrl);
                deeplinkingUrl = null;
            }
        });
    });
    electron_1.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin')
            electron_1.app.quit();
    });
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
    // macOS: evento padrão para url customizada
    electron_1.app.on('open-url', (event, url) => {
        event.preventDefault();
        if (mainWindow) {
            mainWindow.webContents.send('uri', url);
        }
    });
}
// Auth
electron_1.ipcMain.handle('authCredentials', async (event, { email, password }) => {
    const clientId = await (0, client_1.getClientId)();
    try {
        const res = await fetch('http://localhost:3000/api/external/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, clientId }),
        });
        const data = await res.json();
        if (res.ok) {
            await keytar_1.default.setPassword('VoxyLauncher', 'token', data.accessToken);
            console.log(data.user);
            return { success: true, accessToken: data.accessToken, user: data.user };
        }
        else {
            return { success: false, error: data.error || 'Unknown error' };
        }
    }
    catch (error) {
        console.error('Erro ao chamar API de login:', error);
        return { success: false, error: 'INTERNAL_ERROR' };
    }
});
electron_1.ipcMain.handle('openProvider', async (event, { provider }) => {
    const clientId = await (0, client_1.getClientId)();
    shell.openExternal(`http://localhost:3000/external/auth?provider=${provider}&callback=${clientId}`);
});
electron_1.ipcMain.handle('authProvider', async (event, { provider, token }) => {
    const clientId = await (0, client_1.getClientId)();
    const accessToken = (0, crypto_1.randomBytes)(32).toString('hex');
    try {
        const res = await fetch('http://localhost:3000/api/external/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, clientId, refreshToken: token, accessToken }),
        });
        const data = await res.json();
        if (res.ok) {
            await keytar_1.default.setPassword('VoxyLauncher', 'token', accessToken);
            console.log(data.user);
            return { success: true, accessToken: data.accessToken, user: data.user };
        }
        else {
            return { success: false, error: data.error || 'Unknown error' };
        }
    }
    catch (error) {
        console.error('Erro ao chamar API de login:', error);
        return { success: false, error: 'INTERNAL_ERROR' };
    }
});
electron_1.ipcMain.handle('verifyAuth', async (event, { provider }) => {
    if (!provider) {
        return { success: false, error: 'PROVIDER_NOT_PROVIDED' };
    }
    const clientId = await (0, client_1.getClientId)();
    try {
        const accessToken = await keytar_1.default.getPassword('VoxyLauncher', 'token');
        if (!accessToken) {
            return { success: false, error: 'NO_ACCESS_TOKEN' };
        }
        const res = await fetch('http://localhost:3000/api/external/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider,
                clientId,
                accessToken
            })
        });
        const data = await res.json();
        if (res.ok) {
            return { success: true, user: data.user };
        }
        else {
            return { success: false, error: data.error || 'Unknown error' };
        }
    }
    catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        return { success: false, error: 'INTERNAL_ERROR' };
    }
});
electron_1.ipcMain.handle('logout', async (event) => {
    const clientId = await (0, client_1.getClientId)();
    const accessToken = await (0, client_1.getAccessToken)();
    try {
        const accessToken = await keytar_1.default.getPassword('VoxyLauncher', 'token');
        if (!accessToken) {
            return { success: false, error: 'NO_ACCESS_TOKEN' };
        }
        const res = await fetch('http://localhost:3000/api/external/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId,
                accessToken
            })
        });
        const data = await res.json();
        if (res.ok) {
            return { success: true };
        }
        else {
            return { success: false, error: data.error || 'Unknown error' };
        }
    }
    catch (error) {
        console.error('Erro ao logout:', error);
        return { success: false, error: 'INTERNAL_ERROR' };
    }
});
