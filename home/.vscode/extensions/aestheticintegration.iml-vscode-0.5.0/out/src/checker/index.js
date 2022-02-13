"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const proc = require("child_process");
const net = require("net");
const util_1 = require("util");
const assert = require("assert");
const path = require("path");
const crypto = require("crypto");
var state;
(function (state) {
    state[state["Start"] = 0] = "Start";
    state[state["Connecting"] = 1] = "Connecting";
    state[state["Connected"] = 2] = "Connected";
    state[state["Disposed"] = 3] = "Disposed";
})(state || (state = {}));
var CheckBufferWhen;
(function (CheckBufferWhen) {
    CheckBufferWhen["OnEveryChange"] = "change";
    CheckBufferWhen["OnSave"] = "save";
    CheckBufferWhen["OnCommand"] = "command";
})(CheckBufferWhen || (CheckBufferWhen = {}));
function PosToIPos(p) {
    return { line: p.line, char: p.character };
}
function RangeToIRange(r) {
    return { start: PosToIPos(r.start), end: PosToIPos(r.end) };
}
exports.RangeToIRange = RangeToIRange;
function IPosToPos(p) {
    return new vscode.Position(p.line, p.char);
}
function IRangeToRange(r) {
    return new vscode.Range(IPosToPos(r.start), IPosToPos(r.end));
}
function waitForConnectionPromise(server) {
    return new Promise((resolve, _) => {
        server.once("connection", (sock) => {
            resolve(sock);
        });
    });
}
function listenPromise(server) {
    return new Promise((resolve, _) => server.listen(() => resolve()));
}
function isDocIml(d) {
    return d.languageId === "imandra" || d.fileName.endsWith(".iml") || d.fileName.endsWith(".ire");
}
const imandraLogger = vscode.window.createOutputChannel("imandraLogView");
const CUR_PROTOCOL_VERSION = "0.4";
function strByteLen(s) {
    return Buffer.from(s).length;
}
class DocState {
    constructor(d, server) {
        this.curDiags = [];
        this.curDecorationsSmile = [];
        this.curDecorationsPuzzled = [];
        this.hadEditor = false;
        this.doc = d;
        this.curVersion = d.version;
        this.server = server;
    }
    get debug() {
        return this.server.debug;
    }
    get uri() {
        return this.doc.uri;
    }
    get uriStr() {
        return this.doc.uri.fsPath;
    }
    setEditor(ed) {
        assert(this.doc === ed.document);
        if (this.editor) {
            this.editor.setDecorations(this.server.decorationSmile, []);
            this.editor.setDecorations(this.server.decorationPuzzled, []);
        }
        this.editor = ed;
        ed.setDecorations(this.server.decorationSmile, this.curDecorationsSmile);
        ed.setDecorations(this.server.decorationPuzzled, this.curDecorationsPuzzled);
    }
    resetEditor() {
        if (this.editor) {
            this.editor.setDecorations(this.server.decorationSmile, []);
            this.editor.setDecorations(this.server.decorationPuzzled, []);
        }
        this.editor = undefined;
    }
    updateEditor() {
        if (this.editor) {
            this.hadEditor = true;
            this.updateDecorations();
        }
        else if (this.hadEditor) {
            this.hadEditor = false;
            this.curDiags.length = 0;
            this.curDecorationsSmile.length = 0;
            this.curDecorationsPuzzled.length = 0;
            if (this.debug)
                console.log(`send doc_cancel for ${this.uri}:${this.version}`);
            this.server.sendMsg({ kind: "doc_cancel", version: this.version, uri: this.uriStr });
        }
    }
    get hasEditor() {
        return this.editor !== undefined;
    }
    get version() {
        return this.curVersion;
    }
    get document() {
        return this.doc;
    }
    get text() {
        return this.doc.getText();
    }
    addDiagnostic(version, d) {
        if (version === this.version && this.hasEditor) {
            this.curDiags.push(d);
            this.server.diagnostics.set(this.uri, this.curDiags);
        }
    }
    addDecoration(version, kind, d) {
        if (version === this.version && this.hasEditor) {
            switch (kind) {
                case "smile":
                    this.curDecorationsSmile.push(d);
                    break;
                case "puzzled":
                    this.curDecorationsPuzzled.push(d);
                    break;
            }
            this.updateDecorations();
        }
    }
    updateDecorations() {
        if (this.editor) {
            this.editor.setDecorations(this.server.decorationSmile, this.curDecorationsSmile);
            this.editor.setDecorations(this.server.decorationPuzzled, this.curDecorationsPuzzled);
        }
    }
    cleanAll() {
        this.curDiags.length = 0;
        this.server.diagnostics.delete(this.uri);
        this.curDecorationsSmile.length = 0;
        this.curDecorationsPuzzled.length = 0;
        if (this.editor) {
            this.editor.setDecorations(this.server.decorationSmile, []);
            this.editor.setDecorations(this.server.decorationPuzzled, []);
        }
    }
    updateDoc(d) {
        assert(d.uri.fsPath === this.uriStr && d.version >= this.version);
        if (this.server.debug) {
            console.log(`docstate[uri=${d.uri.fsPath}]: update to v${d.version} (current v${this.version})`);
        }
        if (d.version > this.version) {
            this.cleanAll();
        }
        this.doc = d;
        this.curVersion = d.version;
    }
    dispose() {
        this.cleanAll();
    }
}
const PING_FREQ = 20 * 1000;
const MAX_EPOCH_MISSED = 3;
exports.defaultImandraServerConfig = {
    serverPath: "imandra-vscode-server",
    debug: false,
    persistentCache: false,
    autoUpdate: true,
    whenToCheck: CheckBufferWhen.OnEveryChange,
};
class LineBuffer {
    constructor() {
        this.buf = Buffer.alloc(16 * 1024);
        this.len = 0;
        this.lineIdx = 0;
    }
    addBuf(b) {
        if (this.len + b.length > this.buf.length) {
            const newBuf = Buffer.alloc(this.buf.length + b.length + 10);
            this.buf.copy(newBuf);
            this.buf = newBuf;
        }
        assert(this.buf.length >= this.len + b.length);
        b.copy(this.buf, this.len);
        this.len += b.length;
    }
    hasLine() {
        const i = this.buf.slice(0, this.len).indexOf("\n");
        this.lineIdx = i;
        assert(i < this.len, "invalid line index (>len)");
        return i >= 0;
    }
    getLine() {
        const n = this.lineIdx;
        if (n >= 0) {
            assert(n < this.len);
            const s = this.buf.slice(0, n + 1).toString();
            this.buf.copy(this.buf, 0, n + 1);
            this.len -= n + 1;
            this.lineIdx = -1;
            return s;
        }
        else {
            return "";
        }
    }
}
const PROGRESS = ["\\", "|", "/", "-"];
class WrongVersion {
    constructor(v) {
        this.imandraVer = v;
    }
}
class ForceClosed {
}
class ImandraServerConn {
    constructor(config, ctx) {
        this.buffer = new LineBuffer();
        this.st = state.Start;
        this.docs = new Map();
        this.progress = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this.subscriptions = [this.progress];
        this.pingEpoch = 0;
        this.lastPongEpoch = 0;
        this.diagnostics = vscode.languages.createDiagnosticCollection("imandra");
        this.procDie = new vscode.EventEmitter();
        this.config = config;
        this.clearProgress();
        this.server = net.createServer();
        const decoStyle = (iPath, color) => vscode.window.createTextEditorDecorationType({
            overviewRulerColor: color,
            gutterIconPath: ctx.asAbsolutePath(path.join("assets", iPath)),
            gutterIconSize: "70%",
            outlineColor: "green",
        });
        this.decorationSmile = decoStyle("imandra-smile.png", "green");
        this.decorationPuzzled = decoStyle("imandra-wut.png", "orange");
    }
    get debug() {
        return this.config.debug;
    }
    logMessage(d) {
        if (this.debug)
            imandraLogger.appendLine(d);
    }
    setupConn(subproc, sock) {
        this.subproc = subproc;
        this.subprocConn = sock;
        if (this.subproc.pid) {
            this.st = state.Connected;
        }
        else {
            this.st = state.Disposed;
            return;
        }
        sock.setNoDelay();
        sock.setKeepAlive(true);
        this.subproc.on("close", (code, signal) => {
            console.log(`imandra-vscode closed with code=${code}, signal=${signal}`);
            this.dispose();
        });
        this.subproc.on("exit", code => {
            console.log(`imandra-vscode exited with ${code}`);
            this.dispose();
        });
        sock.on("data", data => {
            if (this.debug)
                console.log(`got message from imandra: ${data}`);
            this.buffer.addBuf(data);
            while (this.buffer.hasLine()) {
                const line = this.buffer.getLine().trim();
                if (line === "")
                    continue;
                try {
                    this.logMessage(`Received: ${line}`);
                    const res = JSON.parse(line);
                    this.handleRes(res);
                }
                catch (e) {
                    console.log(`ERROR: could not parse message's line "${line}" as json`);
                }
            }
        });
        const timer = setInterval(() => {
            if (!this.connected())
                return;
            const missed = this.pingEpoch - this.lastPongEpoch;
            if (missed > MAX_EPOCH_MISSED) {
                console.log(`missed ${missed} "ping" epochs, consider the server as dead`);
                this.dispose();
            }
            this.sendMsg({ kind: "ping", epoch: ++this.pingEpoch });
        }, PING_FREQ);
        this.subscriptions.push(new vscode.Disposable(() => {
            console.log("kill ping timer");
            clearInterval(timer);
        }));
    }
    get onProcDied() {
        return this.procDie.event;
    }
    dispose(reason) {
        this.subscriptions.forEach(x => x.dispose());
        this.subscriptions.length = 0;
        this.docs.forEach((d, _) => d.dispose());
        this.diagnostics.clear();
        this.progress.dispose();
        if (this.st !== state.Disposed) {
            console.log("disconnecting imandra-vscode-server…");
            this.st = state.Disposed;
            if (this.subproc) {
                const subproc = this.subproc;
                setTimeout(() => {
                    try {
                        subproc.kill();
                    }
                    catch (_) { }
                }, 800);
            }
            this.subproc = undefined;
            this.server.close();
            this.procDie.fire(reason);
        }
    }
    connected() {
        return this.st === state.Connected;
    }
    async sendMsg(m) {
        const conn = this.subprocConn;
        if (!this.connected() || conn === undefined) {
            console.log("do not send message, imandra-vscode disconnected");
            throw new Error("imandra-vscode disconnected");
        }
        const j = JSON.stringify(m);
        this.logMessage(`send msg ${j}`);
        const isDone = conn.write(j);
        if (!isDone) {
            await util_1.promisify(f => conn.once("drain", () => f(null, {})));
        }
        return;
    }
    async sendDoc(d) {
        const key = d.uri.fsPath;
        const reason = key.endsWith(".ire") || key.endsWith(".re");
        await this.sendMsg({
            kind: "doc_add",
            uri: key,
            reason,
            version: d.version,
            text: d.getText(),
        });
    }
    async addDoc(d) {
        if (!isDocIml(d))
            return;
        const key = d.uri.fsPath;
        const isNew = !this.docs.has(key);
        this.docs.set(key, new DocState(d, this));
        assert(isNew);
        await this.sendDoc(d);
    }
    async removeDoc(d) {
        if (!isDocIml(d))
            return;
        const key = d.uri.fsPath;
        const dSt = this.docs.get(key);
        if (dSt) {
            this.docs.delete(key);
            dSt.dispose();
            await this.sendMsg({ kind: "doc_remove", uri: key });
        }
    }
    async changeDoc(d) {
        if (!isDocIml(d.document))
            return;
        console.log(`[connected: ${this.connected()}]: change doc ${d.document.uri} version ${d.document.version}`);
        const key = d.document.uri.fsPath;
        let needsMsg = true;
        const newVersion = d.document.version;
        const dState = this.docs.get(key);
        if (dState) {
            if (dState.version === newVersion)
                needsMsg = false;
            dState.updateDoc(d.document);
        }
        if (dState && needsMsg) {
            const changes = [];
            for (const { text, range, rangeLength } of d.contentChanges) {
                changes.push({
                    range: RangeToIRange(range),
                    rangeLen: rangeLength,
                    text,
                });
            }
            await this.sendMsg({
                kind: "doc_update",
                uri: key,
                changes,
                version: d.document.version,
            });
            if (this.config.whenToCheck === CheckBufferWhen.OnEveryChange) {
                setTimeout(() => {
                    if (dState.version === newVersion && dState.hasEditor) {
                        this.askToCheckDoc(dState);
                    }
                }, 300);
            }
        }
    }
    async saveDoc(d) {
        if (!isDocIml(d))
            return;
        const key = d.uri.fsPath;
        const dState = this.docs.get(key);
        if (this.config.whenToCheck === CheckBufferWhen.OnSave && dState) {
            this.askToCheckDoc(dState);
        }
    }
    askToCheckDoc(d) {
        const key = d.document.uri.fsPath;
        if (this.debug)
            console.log(`send doc_check for ${d.uri}:${d.version}`);
        this.sendMsg({
            kind: "doc_check",
            uri: key,
            version: d.version,
            len: strByteLen(d.text),
        });
    }
    askToCheckCurrentEditor() {
        const ed = vscode.window.activeTextEditor;
        if (!ed) {
            return;
        }
        const d = ed.document;
        if (!isDocIml(d)) {
            return;
        }
        const key = d.uri.fsPath;
        const dState = this.docs.get(key);
        if (!dState) {
            return;
        }
        this.askToCheckDoc(dState);
    }
    async changeVisibleEditors(eds) {
        this.docs.forEach((d, _) => d.resetEditor());
        for (const ed of eds) {
            const key = ed.document.uri.fsPath;
            const d = this.docs.get(key);
            if (d) {
                d.setEditor(ed);
            }
        }
        this.docs.forEach((d, _) => d.updateEditor());
    }
    setProgress(epoch, timeElapsed) {
        const bar = PROGRESS[epoch % PROGRESS.length];
        const timeSince = timeElapsed === undefined ? "" : ` ${Math.round(timeElapsed * 100) / 100}s`;
        this.progress.text = `[${bar}${timeSince}]`;
        this.progress.show();
    }
    clearProgress() {
        this.progress.text = "[ ]";
    }
    async handleRes(res) {
        switch (res.kind) {
            case "valid": {
                this.clearProgress();
                if (this.debug)
                    console.log(`res (v${res.version}): valid! (range ${util_1.inspect(res.range)})`);
                const d = this.docs.get(res.uri);
                if (d) {
                    const r = IRangeToRange(res.range);
                    const deco = {
                        range: r,
                        hoverMessage: res.msg,
                    };
                    d.addDecoration(res.version, "smile", deco);
                }
                return;
            }
            case "invalid": {
                this.clearProgress();
                if (this.debug)
                    console.log(`res (v${res.version}): invalid! (range ${util_1.inspect(res.range)})`);
                const d = this.docs.get(res.uri);
                if (d) {
                    const r = IRangeToRange(res.range);
                    const deco = {
                        range: r,
                        hoverMessage: res.msg,
                    };
                    d.addDecoration(res.version, "puzzled", deco);
                }
                return;
            }
            case "error": {
                this.clearProgress();
                if (this.debug)
                    console.log(`res (v${res.version}): error! (range ${util_1.inspect(res.range)})`);
                const d = this.docs.get(res.uri);
                if (d) {
                    const r = IRangeToRange(res.range);
                    const sev = vscode.DiagnosticSeverity.Error;
                    const diag = new vscode.Diagnostic(r, res.msg, sev);
                    diag.source = "imandra";
                    d.addDiagnostic(res.version, diag);
                }
                return;
            }
            case "warning": {
                this.clearProgress();
                if (this.debug)
                    console.log(`res (v${res.version}): warning! (range ${util_1.inspect(res.range)})`);
                const d = this.docs.get(res.uri);
                if (d) {
                    const r = IRangeToRange(res.range);
                    const sev = vscode.DiagnosticSeverity.Warning;
                    const diag = new vscode.Diagnostic(r, res.msg, sev);
                    diag.source = "imandra";
                    d.addDiagnostic(res.version, diag);
                }
                return;
            }
            case "hint": {
                this.clearProgress();
                if (this.debug)
                    console.log(`res (v${res.version}): warning! (range ${util_1.inspect(res.range)})`);
                const d = this.docs.get(res.uri);
                if (d) {
                    const r = IRangeToRange(res.range);
                    const sev = vscode.DiagnosticSeverity.Information;
                    const diag = new vscode.Diagnostic(r, res.msg, sev);
                    diag.source = "imandra";
                    d.addDiagnostic(res.version, diag);
                }
                return;
            }
            case "ack": {
                const d = this.docs.get(res.uri);
                if (this.debug)
                    console.log(`got ack for document update version: ${res.version} uri: "${res.uri}"`);
                assert(!d || res.version <= d.version);
                if (d && d.version === res.version) {
                    const text = d.text;
                    const expectedLen = strByteLen(text);
                    if (expectedLen !== res.len) {
                        console.log(`ack: expected len ${expectedLen}, reported len ${res.len}. Resend.`);
                        this.sendDoc(d.document);
                        return;
                    }
                    const expectedMd5 = crypto
                        .createHash("md5")
                        .update(text)
                        .digest("hex");
                    if (expectedLen !== res.len) {
                        console.log(`ack: expected md5 ${expectedMd5}, reported md5 ${res.md5}. Resend.`);
                        this.sendDoc(d.document);
                        return;
                    }
                }
                console.log("document is correct");
                return;
            }
            case "resend": {
                const d = this.docs.get(res.uri);
                if (d) {
                    this.sendDoc(d.document);
                }
                return;
            }
            case "pong": {
                this.lastPongEpoch = Math.max(this.lastPongEpoch, res.epoch);
                return;
            }
            case "version": {
                if (res.v !== CUR_PROTOCOL_VERSION) {
                    console.log(`error: imandra-server has version ${res.v}, not ${CUR_PROTOCOL_VERSION} as expected`);
                    this.dispose(new WrongVersion(res.v));
                }
                return;
            }
            case "progress": {
                this.setProgress(res.epoch, res.timeElapsed);
                return;
            }
            default: {
                const _exhaustiveCheck = res;
                return _exhaustiveCheck;
            }
        }
    }
    async init(onConn) {
        console.log("connecting to imandra-vscode-server...");
        await listenPromise(this.server);
        const port = this.server.address().port;
        const args = [
            ...(this.debug ? ["-d", "4"] : []),
            ...(this.config.persistentCache ? ["--persistent-cache"] : []),
            "--host",
            "127.0.0.1",
            "--port",
            port.toString(),
        ];
        if (this.debug)
            console.log("call imandra-vscode-server with args ", args);
        const sockP = waitForConnectionPromise(this.server);
        const subproc = proc.spawn(this.config.serverPath, args, { stdio: ["ignore", "pipe", "pipe"] });
        if (!subproc.pid) {
            onConn(false);
            this.dispose();
            return;
        }
        subproc.stderr.on("data", msg => {
            if (this.debug)
                console.log(`imandra.stderr: ${msg}`);
        });
        subproc.stdout.on("data", msg => {
            if (this.debug)
                console.log(`imandra.stdout: ${msg}`);
        });
        console.log(`waiting for connection (pid: ${subproc.pid})...`);
        const sock = await sockP;
        console.log("got connection!");
        if (this.subprocConn === undefined) {
            this.setupConn(subproc, sock);
        }
        console.log(`state: ${state[this.st]}, PID ${this.subproc ? this.subproc.pid : 0}`);
        if (this.connected()) {
            for (const d of vscode.workspace.textDocuments)
                this.addDoc(d);
            vscode.workspace.onDidOpenTextDocument(this.addDoc, this, this.subscriptions);
            vscode.workspace.onDidCloseTextDocument(this.removeDoc, this, this.subscriptions);
            vscode.workspace.onDidChangeTextDocument(this.changeDoc, this, this.subscriptions);
            if (this.config.whenToCheck === CheckBufferWhen.OnSave) {
                vscode.workspace.onDidSaveTextDocument(this.saveDoc, this, this.subscriptions);
            }
            await this.changeVisibleEditors(vscode.window.visibleTextEditors);
            vscode.window.onDidChangeVisibleTextEditors(this.changeVisibleEditors, this, this.subscriptions);
        }
        onConn(this.connected());
    }
}
exports.ImandraServerConn = ImandraServerConn;
const MAX_RESTARTS = 5;
const RESTART_LIMIT_TIMEOUT_S = 30;
class ImandraServer {
    constructor(ctx, config) {
        this.nRestarts = 0;
        this.lastSuccessfulStart = Date.now();
        this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 20);
        this.checkButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
        this.subscriptions = [];
        this.ctx = ctx;
        this.config = { ...exports.defaultImandraServerConfig, ...config };
        this.status.hide();
    }
    setStatus(ok, reason) {
        if (ok) {
            this.status.text = "[imandra-server: active ✔]";
            this.status.tooltip = "Connection to imandra-vscode-server established";
            this.status.command = "imandra.server.reload";
        }
        else if (reason === WrongVersion) {
            this.nRestarts = MAX_RESTARTS;
            this.status.text = "[imandra-server: wrong version]";
            this.status.tooltip = `make sure the imandra-vscode-server is compatible (expected ${CUR_PROTOCOL_VERSION}, got ${reason})`;
        }
        else if (reason === ForceClosed) {
            this.status.text = "[imandra-server: force closed]";
            this.status.tooltip = `restart with command: "Imandra: reload semantic server"`;
        }
        else {
            this.status.text = "[imandra-server: dead ×]";
            this.status.tooltip = `Lost connection to imandra-vscode-server (${this.nRestarts} restarts)`;
        }
        this.status.show();
        if (ok)
            this.checkButton.show();
        else
            this.checkButton.hide();
    }
    async trySync() {
        if (this.conn) {
            console.log("send `sync` message");
            try {
                await this.conn.sendMsg("cache_sync");
            }
            catch { }
        }
    }
    restart() {
        if (this.conn) {
            this.trySync();
            this.conn.dispose();
            this.conn = undefined;
        }
        this.nRestarts = 0;
        this.setStatus(false);
        this.setupConn();
    }
    disconnectConn() {
        if (this.conn) {
            this.trySync();
            this.conn.dispose(ForceClosed);
            this.conn = undefined;
            this.setStatus(false, ForceClosed);
        }
    }
    setupConn() {
        if (this.conn && this.conn.connected())
            return;
        const timeSince = Date.now() - this.lastSuccessfulStart;
        if (this.nRestarts > MAX_RESTARTS && timeSince < RESTART_LIMIT_TIMEOUT_S) {
            console.log(`did ${this.nRestarts} restarts of imandra-vscode-server within ${timeSince}s, give up`);
            this.conn = undefined;
            this.setStatus(false);
            return;
        }
        this.conn = new ImandraServerConn(this.config, this.ctx);
        this.conn.onProcDied((reason) => {
            if (!(reason === ForceClosed)) {
                this.conn = undefined;
                this.setStatus(false, reason);
                this.nRestarts++;
                if (reason === undefined) {
                    setTimeout(() => {
                        console.log("try to restart imandra-vscode-server");
                        this.setupConn();
                    }, 5 * 1000);
                }
            }
        });
        this.conn.init(ok => {
            this.setStatus(ok);
            if (ok) {
                this.nRestarts = 0;
                this.lastSuccessfulStart = Date.now();
            }
            else {
                this.conn = undefined;
            }
        });
    }
    tryToCheck() {
        console.log("imandra.server.check called");
        if (this.conn) {
            this.conn.askToCheckCurrentEditor();
        }
        else {
            vscode.window.showErrorMessage("not connected to imandra.");
        }
    }
    init() {
        console.log("init imandra server...");
        this.subscriptions.push(vscode.commands.registerCommand("imandra.server.reload", () => {
            console.log("imandra.server.reload called");
            this.restart();
        }), vscode.commands.registerCommand("imandra.server.cache.clear", () => {
            console.log("imandra.server.cache.clear called");
            if (this.conn)
                this.conn.sendMsg("cache_clear");
        }), vscode.commands.registerCommand("imandra.server.cache.sync", () => {
            console.log("imandra.server.cache.sync called");
            if (this.conn)
                this.conn.sendMsg("cache_sync");
        }), vscode.commands.registerCommand("imandra.server.disconnect", () => {
            console.log("imandra.server.disconnect called");
            this.disconnectConn();
        }), vscode.commands.registerCommand("imandra.server.check", () => {
            this.tryToCheck();
        }));
        this.checkButton.text = "[check buffer]";
        this.checkButton.command = "imandra.server.check";
        this.checkButton.tooltip = "ask Imandra to check the buffer.";
        this.setupConn();
    }
    async dispose() {
        this.status.dispose();
        this.subscriptions.forEach(d => d.dispose());
        this.subscriptions.length = 0;
        if (this.conn) {
            await this.trySync();
            this.conn.dispose();
            this.conn = undefined;
        }
    }
}
exports.ImandraServer = ImandraServer;
let cur = null;
async function launch(ctx) {
    const imandraConfig = vscode.workspace.getConfiguration("imandra");
    const whenToCheck = imandraConfig.get("imandra-vscode-server.check", CheckBufferWhen.OnEveryChange);
    const config = {
        ...exports.defaultImandraServerConfig,
        debug: imandraConfig.get("debug.imandra-vscode-server", false),
        serverPath: imandraConfig.get("path.imandra-vscode-server", "imandra-vscode-server"),
        persistentCache: imandraConfig.get("dev.cache.imandra-vscode-server", false),
        autoUpdate: imandraConfig.get("debug.auto-update-server", true),
        whenToCheck,
    };
    console.log(`imandra.debug: ${config.debug}, persistent cache: ${config.persistentCache}, \
    auto update: ${config.autoUpdate}, when to check: ${config.whenToCheck}`);
    const server = new ImandraServer(ctx, config);
    if (cur)
        cur.dispose();
    cur = server;
    server.init();
    return Promise.resolve(server);
}
exports.launch = launch;
async function deactivate() {
    if (cur) {
        await cur.dispose();
    }
    cur = null;
}
exports.deactivate = deactivate;
//# sourceMappingURL=index.js.map