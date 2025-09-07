"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const uriListeners = new Map();
electron_1.contextBridge.exposeInMainWorld("electron", {
    ipcRenderer: {
        send: (channel, ...args) => electron_1.ipcRenderer.send(channel, ...args),
        invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
        on: (channel, listener) => electron_1.ipcRenderer.on(channel, listener),
        removeAllListeners: (channel) => electron_1.ipcRenderer.removeAllListeners(channel),
        onCustomURL: (callback) => {
            const listener = (_event, url) => callback(url);
            uriListeners.set(callback, listener);
            electron_1.ipcRenderer.on('uri', listener);
        },
        removeCustomURL: (callback) => {
            const listener = uriListeners.get(callback);
            if (listener) {
                electron_1.ipcRenderer.removeListener('uri', listener);
                uriListeners.delete(callback);
            }
        },
        // Funções específicas
        openLink: (url) => electron_1.ipcRenderer.invoke("open-link", url),
        readFile: (filePath) => electron_1.ipcRenderer.invoke("read-file", filePath),
        writeFile: (filePath, data) => electron_1.ipcRenderer.invoke("write-file", filePath, data),
        // Autenticação Microsoft
        logoutMicrosoft: () => electron_1.ipcRenderer.invoke("logoutMicrosoft"),
        loginMicrosoft: () => electron_1.ipcRenderer.invoke("loginMicrosoft"),
        loadMicrosoft: () => electron_1.ipcRenderer.invoke("loadMicrosoft"),
        // Lançamento do Minecraft
        launchMinecraft: (version, type, loginMode, uuid, name) => electron_1.ipcRenderer.invoke("launch-minecraft", version, type, loginMode, uuid, name),
        // Banco de Dados
        cacheDb: {
            put: (table, key, value) => electron_1.ipcRenderer.invoke("cacheDb:put", table, key, value),
            get: (table, key) => electron_1.ipcRenderer.invoke("cacheDb:get", table, key),
            update: (table, key, value) => electron_1.ipcRenderer.invoke("cacheDb:update", table, key, value),
            delete: (table, key) => electron_1.ipcRenderer.invoke("cacheDb:delete", table, key),
        },
        mainDb: {
            insert: (table, key, value) => electron_1.ipcRenderer.invoke("mainDb:insert", table, key, value),
            get: (table, key) => electron_1.ipcRenderer.invoke("mainDb:get", table, key),
            update: (table, key, value) => electron_1.ipcRenderer.invoke("mainDb:update", table, key, value),
            delete: (table, key) => electron_1.ipcRenderer.invoke("mainDb:delete", table, key),
        },
    },
});
