"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const imandra_language_server_1 = require("imandra-language-server");
const vscode = require("vscode");
function register(context, languageClient) {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand("imandra.showAvailableLibraries", async (editor) => {
        const docURI = {
            uri: editor.document.uri.toString(),
        };
        const libraryLines = languageClient.sendRequest(imandra_language_server_1.remote.server.giveAvailableLibraries, docURI);
        await vscode.window.showQuickPick(libraryLines);
        return;
    }));
}
exports.register = register;
//# sourceMappingURL=doShowAvailableLibraries.js.map