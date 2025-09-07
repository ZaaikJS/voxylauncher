"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadAndExtractJRE = downloadAndExtractJRE;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const unzipper_1 = __importDefault(require("unzipper"));
const follow_redirects_1 = require("follow-redirects");
const JRE_URL = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.7%2B6/OpenJDK21U-jre_x64_windows_hotspot_21.0.7_6.zip";
async function downloadAndExtractJRE(destFolder, onProgress) {
    const zipPath = path_1.default.join(destFolder, "jre.zip");
    fs_1.default.mkdirSync(destFolder, { recursive: true });
    return new Promise((resolve, reject) => {
        const file = fs_1.default.createWriteStream(zipPath);
        follow_redirects_1.https.get(JRE_URL, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Falha ao baixar o JRE: status ${response.statusCode}`));
            }
            const totalSize = parseInt(response.headers['content-length'] || "0", 10);
            let downloaded = 0;
            response.on("data", (chunk) => {
                downloaded += chunk.length;
                if (onProgress && totalSize > 0) {
                    const percent = (downloaded / totalSize) * 100;
                    onProgress(parseFloat(percent.toFixed(2)));
                }
            });
            response.pipe(file);
            file.on("finish", () => {
                file.close(async () => {
                    try {
                        const zipStream = fs_1.default.createReadStream(zipPath).pipe(unzipper_1.default.Extract({ path: destFolder }));
                        zipStream.on("close", () => {
                            fs_1.default.unlinkSync(zipPath);
                            resolve();
                        });
                        zipStream.on("error", reject);
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        }).on("error", reject);
    });
}
