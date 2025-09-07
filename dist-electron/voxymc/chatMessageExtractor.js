"use strict";
// Classe responsável por converter componentes de chat (JSON) em texto legacy (§)
// Independente do código do proxy.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessageExtractor = void 0;
class ChatMessageExtractor {
    translateMap;
    enableLogging;
    constructor(options = {}) {
        this.translateMap = options.translateMap || {
        // Exemplo: 'chat.type.text': '<%s> %s',
        // Adicione aqui chaves que você quer traduzir de fato.
        };
        this.enableLogging = !!options.enableLogging;
    }
    log(...args) {
        if (this.enableLogging)
            console.log('[ChatMessageExtractor]', ...args);
    }
    extract(rawReason) {
        try {
            let comp = rawReason;
            // Buffer -> string
            // (Buffer é global no Node com @types/node)
            if (typeof Buffer !== 'undefined' && Buffer.isBuffer(comp)) {
                comp = comp.toString('utf8');
            }
            if (typeof comp === 'string') {
                const trimmed = comp.trim();
                const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');
                // Se não parece JSON ou já contém códigos legacy, retorna direto
                if (!looksJson || /§[0-9a-fk-orx]/i.test(trimmed)) {
                    return comp;
                }
                comp = JSON.parse(trimmed);
            }
            // Agora comp é objeto/array
            const currentStyle = this.createEmptyStyle();
            const stack = [{ node: comp, style: this.cloneStyle(currentStyle) }];
            let finalOut = '';
            while (stack.length) {
                const frame = stack.pop();
                const { node, style } = frame;
                if (Array.isArray(node)) {
                    for (let i = node.length - 1; i >= 0; i--) {
                        stack.push({ node: node[i], style: this.cloneStyle(style) });
                    }
                    continue;
                }
                if (typeof node === 'string') {
                    const codes = this.applyStyle(style, currentStyle);
                    Object.assign(currentStyle, style);
                    finalOut += codes + node;
                    continue;
                }
                if (node == null || typeof node !== 'object')
                    continue;
                // node é ChatObject
                const effective = this.cloneStyle(style);
                for (const k of this.styleKeys()) {
                    if (node[k] !== undefined) {
                        effective[k] = node[k];
                    }
                }
                const codes = this.applyStyle(effective, currentStyle);
                Object.assign(currentStyle, effective);
                if (codes)
                    finalOut += codes;
                if (node.translate) {
                    finalOut += this.renderTranslateNode(node, effective);
                }
                else if (node.text) {
                    finalOut += node.text;
                }
                if (Array.isArray(node.extra)) {
                    const extra = node.extra;
                    for (let i = extra.length - 1; i >= 0; i--) {
                        stack.push({ node: extra[i], style: this.cloneStyle(currentStyle) });
                    }
                }
            }
            return finalOut || (typeof rawReason === 'string' ? rawReason : 'Desconectado');
        }
        catch (e) {
            this.log('Erro ao extrair mensagem:', e?.message ?? e);
            return typeof rawReason === 'string' ? rawReason : 'Desconectado';
        }
    }
    // -------- Internos --------
    styleKeys() {
        return ['color', 'bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'];
    }
    createEmptyStyle() {
        return {
            color: null,
            bold: false,
            italic: false,
            underlined: false,
            strikethrough: false,
            obfuscated: false
        };
    }
    cloneStyle(s) {
        return {
            color: s.color,
            bold: s.bold,
            italic: s.italic,
            underlined: s.underlined,
            strikethrough: s.strikethrough,
            obfuscated: s.obfuscated
        };
    }
    isHexColor(c) {
        return typeof c === 'string' && /^#?[0-9a-fA-F]{6}$/.test(c);
    }
    hexToLegacy(c) {
        const hex = c.replace('#', '').toLowerCase();
        return '§x' + hex.split('').map(ch => '§' + ch).join('');
    }
    colorMap() {
        return {
            black: '§0', dark_blue: '§1', dark_green: '§2', dark_aqua: '§3',
            dark_red: '§4', dark_purple: '§5', gold: '§6', gray: '§7',
            dark_gray: '§8', blue: '§9', green: '§a', aqua: '§b',
            red: '§c', light_purple: '§d', yellow: '§e', white: '§f'
        };
    }
    formatCodes() {
        return {
            bold: '§l',
            italic: '§o',
            underlined: '§n',
            strikethrough: '§m',
            obfuscated: '§k'
        };
    }
    applyStyle(newStyle, prevStyle) {
        const RESET = '§r';
        const colorMap = this.colorMap();
        const formatCodes = this.formatCodes();
        let needReset = false;
        if (prevStyle.color !== newStyle.color)
            needReset = true;
        for (const k of ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated']) {
            if (prevStyle[k] && !newStyle[k]) {
                needReset = true;
                break;
            }
        }
        let out = '';
        if (needReset) {
            out += RESET;
            if (newStyle.color) {
                if (newStyle.color in colorMap) {
                    out += colorMap[newStyle.color];
                }
                else if (this.isHexColor(newStyle.color)) {
                    out += this.hexToLegacy(newStyle.color);
                }
            }
            for (const k of ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated']) {
                if (newStyle[k])
                    out += formatCodes[k];
            }
            return out;
        }
        // Mudanças sem reset
        if (prevStyle.color !== newStyle.color) {
            if (newStyle.color) {
                if (newStyle.color in colorMap) {
                    out += colorMap[newStyle.color];
                }
                else if (this.isHexColor(newStyle.color)) {
                    out += this.hexToLegacy(newStyle.color);
                }
            }
            else {
                out += RESET;
                for (const k of ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated']) {
                    if (newStyle[k])
                        out += formatCodes[k];
                }
                return out;
            }
        }
        for (const k of ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated']) {
            if (newStyle[k] && !prevStyle[k])
                out += formatCodes[k];
        }
        return out;
    }
    renderTranslateNode(node, inheritedStyle) {
        const pattern = this.translateMap[node.translate] || node.translate;
        const withArr = Array.isArray(node.with) ? node.with : [];
        let idx = 0;
        return pattern.replace(/%(\d+\$)?s/g, (_m, pos) => {
            let useIndex = idx;
            if (pos)
                useIndex = parseInt(pos, 10) - 1;
            const arg = withArr[useIndex];
            idx++;
            if (arg === undefined)
                return _m;
            return this.renderInline(arg, inheritedStyle);
        });
    }
    renderInline(arg, inheritedStyle) {
        if (typeof arg === 'string')
            return arg;
        const currentStyle = this.cloneStyle(inheritedStyle);
        const stack = [{ node: arg, style: this.cloneStyle(inheritedStyle) }];
        let out = '';
        while (stack.length) {
            const frame = stack.pop();
            const { node, style } = frame;
            if (Array.isArray(node)) {
                for (let i = node.length - 1; i >= 0; i--) {
                    stack.push({ node: node[i], style: this.cloneStyle(style) });
                }
                continue;
            }
            if (typeof node === 'string') {
                const codes = this.applyStyle(style, currentStyle);
                Object.assign(currentStyle, style);
                out += codes + node;
                continue;
            }
            if (node == null || typeof node !== 'object')
                continue;
            const effective = this.cloneStyle(style);
            for (const k of this.styleKeys()) {
                if (node[k] !== undefined) {
                    effective[k] = node[k];
                }
            }
            const codes = this.applyStyle(effective, currentStyle);
            Object.assign(currentStyle, effective);
            if (codes)
                out += codes;
            if (node.translate) {
                out += this.renderTranslateNode(node, effective);
            }
            else if (node.text) {
                out += node.text;
            }
            if (Array.isArray(node.extra)) {
                const extra = node.extra;
                for (let i = extra.length - 1; i >= 0; i--) {
                    stack.push({ node: extra[i], style: this.cloneStyle(currentStyle) });
                }
            }
        }
        return out;
    }
}
exports.ChatMessageExtractor = ChatMessageExtractor;
