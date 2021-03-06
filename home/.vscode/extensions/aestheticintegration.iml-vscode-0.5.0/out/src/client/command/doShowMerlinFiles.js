"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const imandra_language_server_1 = require("imandra-language-server");
const vscode = require("vscode");
function register(context, languageClient) {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand("imandra.showMerlinFiles", async (editor) => {
        const docURI = {
            uri: editor.document.uri.toString(),
        };
        const merlinFiles = await languageClient.sendRequest(imandra_language_server_1.remote.server.giveMerlinFiles, docURI);
        const selected = await vscode.window.showQuickPick(merlinFiles);
        if (null == selected)
            return;
        const textDocument = await vscode.workspace.openTextDocument(selected);
        await vscode.window.showTextDocument(textDocument);
    }));
}
exports.register = register;
//# sourceMappingURL=doShowMerlinFiles.js.map