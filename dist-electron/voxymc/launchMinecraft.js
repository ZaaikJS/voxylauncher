"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUser = void 0;
exports.handleLogin = handleLogin;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const keytar_1 = __importDefault(require("keytar"));
const msmc_1 = require("msmc");
const minecraft_launcher_core_1 = require("minecraft-launcher-core");
const client_1 = require("../client");
const javaw_1 = require("./javaw");
const minecraft_protocol_1 = __importStar(require("minecraft-protocol"));
const chatMessageExtractor_1 = require("./chatMessageExtractor");
/* ============================================================================
 * Constantes & Tipos
 * ==========================================================================*/
const SERVICE_NAME = "VoxyLauncher";
const ACCOUNT_NAME = "user_session";
const API_URL = "http://localhost:3000";
const launcher = new minecraft_launcher_core_1.Client();
let authorization = null;
let proxy = null;
const rootPath = path_1.default.join(electron_1.app.getPath('userData'), 'Games', 'Minecraft');
fs_1.default.mkdirSync(rootPath, { recursive: true });
const runtimePath = path_1.default.join(rootPath, "runtime");
const javaExe = path_1.default.join(runtimePath, "jdk-21.0.7+6-jre", "bin", "java.exe");
/* ============================================================================
 * Utilidades
 * ==========================================================================*/
/** Type guard simples para VoxyUser */
function isVoxyUser(data) {
    if (!data || typeof data !== 'object')
        return false;
    const d = data;
    // Não exigimos tudo—só checamos caminhos que vamos ler.
    if (d.games && typeof d.games === 'object') {
        const g = d.games._minecraft;
        if (g && typeof g === 'object') {
            // username é opcional, mas se existir deve ser string
            if ('username' in g && g.username != null && typeof g.username !== 'string')
                return false;
        }
    }
    return true;
}
/* ============================================================================
 * API local: obter usuário
 * ==========================================================================*/
const getUser = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const [clientId, accessToken] = await Promise.all([
            (0, client_1.getClientId)(),
            (0, client_1.getAccessToken)(),
        ]);
        const url = new URL(`${API_URL}/api/external/game/voxymc`);
        url.search = new URLSearchParams({
            fn: "verify",
            clientId: String(clientId),
            accessToken: String(accessToken),
        }).toString();
        const res = await fetch(url.toString(), {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });
        let data = null;
        try {
            data = await res.json();
        }
        catch {
            // ignora: pode não ser JSON
        }
        if (!res.ok) {
            const msg = (data && (data.error || data.message)) ||
                `Falha na requisição (${res.status})`;
            throw new Error(msg);
        }
        return { available: true, data: data };
    }
    catch (err) {
        const message = err?.name === "AbortError"
            ? "Tempo de requisição excedido."
            : err?.message || "Erro inesperado.";
        return { available: false, error: message };
    }
    finally {
        clearTimeout(timeout);
    }
};
exports.getUser = getUser;
/* ============================================================================
 * Código diário por dia da semana
 * ==========================================================================*/
const dailyCodes = [
    "DOM123", "SEG234", "TER345", "QUA456", "QUI567", "SEX678", "SAB789"
];
function getTodayCode() {
    const tz = "America/Sao_Paulo";
    const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "short" })
        .formatToParts(new Date());
    const raw = parts.find(p => p.type === "weekday")?.value || "dom";
    // normaliza: minúsculas, remove acentos e pontos, fica com 3 letras
    const key = raw
        .toLowerCase()
        .normalize("NFD").replace(/\p{Diacritic}/gu, "")
        .replace(/\./g, "")
        .slice(0, 3); // dom, seg, ter, qua, qui, sex, sab
    const map = {
        dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6
    };
    const idx = map[key] ?? 0;
    return dailyCodes[idx];
}
/* ============================================================================
 * Proxy e login
 * ==========================================================================*/
const messageExtractor = new chatMessageExtractor_1.ChatMessageExtractor({
    enableLogging: false,
    translateMap: {}
});
function handleLogin(proxyServer, client) {
    console.log(`[Proxy] Jogador conectou: ${client.username}`);
    const targetClient = minecraft_protocol_1.default.createClient({
        host: "launcherpvp.voxymc.net",
        port: 10159,
        username: client.username,
        version: client.version,
        auth: "offline",
    });
    // helper p/ extrair mensagem legível do motivo
    function extractMessage(rawReason) {
        return messageExtractor.extract(rawReason);
    }
    targetClient.once("login", async () => {
        console.log("[Proxy] Cliente conectado, requisitando token à API...");
        try {
            const payload = { username: client.username, code: getTodayCode() };
            const res = await fetch(`${API_URL}/api/external/game/voxymc/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(`Falha ao obter token: ${res.status} ${res.statusText} ${txt}`);
            }
            const data = await res.json();
            const token = data?.token ?? "null:null:null:null";
            const bufferPayload = Buffer.from(token, "utf8");
            targetClient.write("custom_payload", {
                channel: "voxy:auth",
                data: bufferPayload
            });
        }
        catch (e) {
            console.error("[Proxy] Erro ao buscar token na API:", e);
            // fallback seguro: envia payload nulo para o servidor
            const bufferPayload = Buffer.from("null:null:null:null", "utf8");
            targetClient.write("custom_payload", {
                channel: "voxy:auth",
                data: bufferPayload
            });
        }
    });
    // Eventos para finalizar com motivo legível
    targetClient.on("kick_disconnect", (packet) => {
        const message = extractMessage(packet.reason);
        end(message);
    });
    targetClient.on("disconnect", (packet) => {
        const message = extractMessage(packet.reason);
        end(message);
    });
    client.on("packet", (data, meta) => {
        if (targetClient.state === minecraft_protocol_1.states.PLAY && meta.state === minecraft_protocol_1.states.PLAY) {
            targetClient.write(meta.name, data);
        }
    });
    targetClient.on("packet", (data, meta) => {
        if (client.state === minecraft_protocol_1.states.PLAY && meta.state === minecraft_protocol_1.states.PLAY) {
            client.write(meta.name, data);
        }
    });
    // Encerramento
    client.on("end", () => {
        console.log("[Proxy] Cliente saiu...");
        const reason = "Desconectado";
        if (targetClient.state === minecraft_protocol_1.states.PLAY) {
            const buf = Buffer.from(reason, "utf8");
            targetClient.write("custom_payload", {
                channel: "voxy:logout",
                data: buf,
            });
        }
        end(reason);
    });
    targetClient.on("end", (reason) => {
        const msg = typeof reason === "string" ? reason : extractMessage(reason) || "Conexão com servidor perdida";
        end(msg);
    });
    client.on("error", (e) => {
        console.error("[Proxy] Erro cliente:", e);
        end("Erro de conexão");
    });
    targetClient.on("error", (e) => {
        console.error("[Proxy] Erro servidor:", e);
        end("Erro de conexão com servidor");
    });
    const end = (reason) => {
        if (!client.ended) {
            try {
                client.end(reason || "Desconectado");
            }
            catch { }
        }
        if (!targetClient.ended) {
            try {
                targetClient.end(reason);
            }
            catch { }
        }
    };
}
/* ============================================================================
 * IPC: Lançar Minecraft
 * ==========================================================================*/
electron_1.ipcMain.handle("launch-minecraft", async (event, version, type, loginMode, uuid, name) => {
    try {
        const userRes = await (0, exports.getUser)();
        if (loginMode === "voxy") {
            if (!userRes.available) {
                throw new Error(userRes.error || "Não foi possível obter o usuário.");
            }
            // valida o shape antes de usar
            const data = userRes.data;
            if (!isVoxyUser(data)) {
                throw new Error("Formato inesperado de usuário retornado pela API local.");
            }
            const username = data?.games?._minecraft?.username ?? name;
            authorization = { name: username, uuid, access_token: "offline" };
        }
        else {
            const session = await loadSession();
            if (!session) {
                throw new Error("Não foi possível carregar a sessão Microsoft.");
            }
            console.log("Sessão encontrada, reutilizando...");
            authorization = session;
        }
        const opts = {
            clientPackage: null,
            authorization,
            root: rootPath,
            version: { number: version, type },
            javaPath: javaExe,
            memory: { max: "6G", min: "4G" },
        };
        if (!fs_1.default.existsSync(javaExe)) {
            console.log("JRE não encontrado. Baixando...");
            event.sender.send("download-progress", {
                current: 0,
                total: 100,
                type: "Java"
            });
            await (0, javaw_1.downloadAndExtractJRE)(runtimePath, (percent) => {
                event.sender.send("download-progress", {
                    current: percent,
                    total: 100,
                    type: "Java"
                });
            });
            console.log("JRE baixado e extraído.");
            event.sender.send("download-complete", { type: "Java" });
        }
        // Inicializando proxy (somente para login voxy/offline)
        if (loginMode === "voxy") {
            if (proxy) {
                try {
                    for (const id in proxy.clients) {
                        proxy.clients[id]?.end("Reiniciando proxy");
                    }
                    proxy.close();
                }
                catch { /* noop */ }
                proxy = null;
            }
            proxy = minecraft_protocol_1.default.createServer({
                'online-mode': false,
                host: '0.0.0.0',
                port: 25565,
                version: version
            });
            proxy.on("login", (client) => {
                handleLogin(proxy, client);
            });
            console.log("[Proxy] Servidor proxy iniciado na porta 25565");
        }
        launcher.launch(opts);
        event.sender.send("minecraft-started");
        launcher.on("data", (_log) => {
            // logs do launcher, se necessário
        });
        launcher.on("progress", (progress) => {
            if (progress?.total > 0) {
                event.sender.send("download-progress", {
                    current: progress.task,
                    total: progress.total,
                    type: progress.type,
                });
                if (progress.task >= progress.total) {
                    event.sender.send("download-complete", { type: progress.type });
                }
            }
        });
        launcher.on("close", () => {
            event.sender.send("minecraft-closed");
            if (proxy) {
                try {
                    for (const id in proxy.clients) {
                        proxy.clients[id]?.end("Proxy encerrado");
                    }
                    proxy.close();
                }
                catch (e) {
                    console.error("[Proxy] Erro ao encerrar:", e);
                }
                finally {
                    proxy = null;
                }
                console.log("[Proxy] Encerrado após o fechamento do minecraft");
            }
        });
        return { success: true };
    }
    catch (error) {
        console.error("Erro ao iniciar o Minecraft:", error);
        return { success: false, error: error?.message ?? String(error) };
    }
});
/* ============================================================================
 * Sessão Microsoft (Keytar)
 * ==========================================================================*/
async function loadSession() {
    const data = await keytar_1.default.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    if (!data)
        return null;
    const session = JSON.parse(data);
    // se houver exp na meta e estiver expirado, renova
    if (session?.meta?.exp && Date.now() >= session.meta.exp) {
        const authManager = new msmc_1.Auth("select_account");
        const xboxManager = await authManager.launch("electron");
        const token = await xboxManager.getMinecraft();
        const renewed = token.mclc();
        await saveSession(renewed);
        return renewed;
    }
    return session;
}
async function saveSession(session) {
    await keytar_1.default.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify(session));
}
/* ============================================================================
 * IPC: Microsoft Auth
 * ==========================================================================*/
electron_1.ipcMain.handle("loginMicrosoft", async (_event, email) => {
    const clientId = await (0, client_1.getClientId)();
    const accessToken = await (0, client_1.getAccessToken)();
    try {
        const authManager = new msmc_1.Auth("select_account");
        const xboxManager = await authManager.launch("electron");
        const token = await xboxManager.getMinecraft();
        const mclcAuth = token.mclc();
        const xboxParent = token.parent;
        // access_token
        console.log({ authorization: mclcAuth });
        const res = await fetch(`${API_URL}/api/external/game/voxymc?t=microsoft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, accessToken, uuid: mclcAuth.uuid, xbox: xboxParent })
        });
        // Opcional: lidar com erro da API
        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            console.error("API microsoft (local) retornou erro:", res.status, txt);
        }
        await saveSession(mclcAuth);
        authorization = mclcAuth;
        return { success: true, authorization: mclcAuth };
    }
    catch (error) {
        console.error("Erro ao autenticar com a Microsoft:", error);
        return { success: false, error: error?.message ?? "Erro desconhecido" };
    }
});
electron_1.ipcMain.handle("logoutMicrosoft", async () => {
    await keytar_1.default.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    authorization = null;
});
electron_1.ipcMain.handle("loadMicrosoft", async () => {
    return await loadSession();
});
/* ============================================================================
 * IPC: Utilidades Voxy
 * ==========================================================================*/
electron_1.ipcMain.handle('fetch-user', async () => {
    try {
        return await (0, exports.getUser)();
    }
    catch (err) {
        return { available: false, error: err?.message || 'Erro inesperado.' };
    }
});
electron_1.ipcMain.handle('check-voxymc-nick', async (_event, nick) => {
    const clientId = await (0, client_1.getClientId)();
    const accessToken = await (0, client_1.getAccessToken)();
    try {
        // conserto do "?": remover o "?" antes de accessToken
        const url = `${API_URL}/api/external/game/voxymc?fn=nick&username=${encodeURIComponent(nick)}&clientId=${clientId}&accessToken=${accessToken}`;
        const res = await fetch(url);
        let data = null;
        try {
            data = await res.json();
        }
        catch { /* noop */ }
        if (!res.ok) {
            throw new Error(data?.error || 'Erro desconhecido.');
        }
        return { available: !data?.exists };
    }
    catch (err) {
        return { available: false, error: err?.message || 'Erro inesperado.' };
    }
});
electron_1.ipcMain.handle('update-voxymc-nick', async (_event, _email, username) => {
    const clientId = await (0, client_1.getClientId)();
    const accessToken = await (0, client_1.getAccessToken)();
    try {
        const res = await fetch(`${API_URL}/api/external/game/voxymc?t=voxyaccount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, accessToken, username })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.error || 'Erro desconhecido.');
        }
        return { success: true, message: data?.message ?? 'Atualizado com sucesso.' };
    }
    catch (err) {
        return { success: false, error: err?.message || 'Erro inesperado.' };
    }
});
