"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showInputBox = exports.showQuickPick = void 0;
const vscode_1 = require("vscode");
/**
 * Shows a pick list using window.showQuickPick().
 */
async function showQuickPick() {
    let i = 0;
    const result = await vscode_1.window.showQuickPick(['eins', 'zwei', 'drei'], {
        placeHolder: 'eins, zwei or drei',
        onDidSelectItem: item => vscode_1.window.showInformationMessage(`Focus ${++i}: ${item}`)
    });
    vscode_1.window.showInformationMessage(`Got: ${result}`);
}
exports.showQuickPick = showQuickPick;
/**
 * Shows an input box using window.showInputBox().
 */
async function showInputBox() {
    const result = await vscode_1.window.showInputBox({
        value: 'abcdef',
        valueSelection: [2, 4],
        placeHolder: 'For example: fedcba. But not: 123',
        validateInput: text => {
            vscode_1.window.showInformationMessage(`Validating: ${text}`);
            return text === '123' ? 'Not 123!' : null;
        }
    });
    vscode_1.window.showInformationMessage(`Got: ${result}`);
}
exports.showInputBox = showInputBox;
//# sourceMappingURL=basicInput.js.map