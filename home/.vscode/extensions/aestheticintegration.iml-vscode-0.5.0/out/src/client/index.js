"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode = require("vscode");
const client = require("vscode-languageclient");
const command = require("./command");
const request = require("./request");
class ClientWindow {
    constructor() {
        this.merlin = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
        this.merlin.text = "$(hubot) [loading]";
        this.merlin.command = "imandra.showMerlinFiles";
        this.merlin.show();
        return this;
    }
    dispose() {
        this.merlin.dispose();
    }
}
class ErrorHandler {
    closed() {
        return client.CloseAction.DoNotRestart;
    }
    error() {
        return client.ErrorAction.Shutdown;
    }
}
let curClient;
async function launch(context) {
    const imandraConfig = vscode.workspace.getConfiguration("imandra");
    const module = context.asAbsolutePath(path.join("node_modules", "imandra-language-server", "bin", "server"));
    const options = { execArgv: ["--nolazy", "--inspect=6009"] };
    const transport = client.TransportKind.ipc;
    const run = { module, transport };
    const debug = {
        module,
        options,
        transport,
    };
    const serverOptions = { run, debug };
    const languages = imandraConfig.get("server.languages", ["imandra", "imandra-reason"]);
    const documentSelector = new Array();
    for (const language of languages) {
        documentSelector.push({ language, scheme: "file" });
        documentSelector.push({ language, scheme: "untitled" });
    }
    const clientOptions = {
        diagnosticCollectionName: "imandra-language-server",
        documentSelector,
        errorHandler: new ErrorHandler(),
        initializationOptions: imandraConfig,
        outputChannelName: "Imandra Language Server",
        stdioEncoding: "utf8",
        synchronize: {
            configurationSection: "imandra",
            fileEvents: [
                vscode.workspace.createFileSystemWatcher("**/*.iml"),
                vscode.workspace.createFileSystemWatcher("**/*.ire"),
                vscode.workspace.createFileSystemWatcher("**/_build"),
                vscode.workspace.createFileSystemWatcher("**/_build/*"),
            ],
        },
    };
    const languageClient = new client.LanguageClient("Imandra", serverOptions, clientOptions);
    const window = new ClientWindow();
    const session = languageClient.start();
    curClient = languageClient;
    context.subscriptions.push(window);
    context.subscriptions.push(session);
    const reloadCmd = vscode.commands.registerCommand("imandra.merlin.reload", () => {
        console.log("imandra.merlin.reload called");
        restart(context);
    });
    context.subscriptions.push(reloadCmd);
    await languageClient.onReady();
    command.registerAll(context, languageClient);
    request.registerAll(context, languageClient);
    window.merlin.text = "$(hubot) [imandra-merlin]";
    window.merlin.tooltip = "Imandra merlin server online";
    return {
        dispose() {
            if (curClient)
                curClient.stop();
        },
    };
}
exports.launch = launch;
async function restart(context) {
    if (curClient !== undefined) {
        await curClient.stop();
        curClient = undefined;
    }
    return launch(context);
}
exports.restart = restart;
//# sourceMappingURL=index.js.map