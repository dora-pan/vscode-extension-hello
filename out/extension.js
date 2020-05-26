"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode_1 = require("vscode");
const autoCodeService_1 = require("./autoCodeService");
function activate(context) {
    context.subscriptions.push(vscode_1.commands.registerCommand("hello.helloCli", () => __awaiter(this, void 0, void 0, function* () {
        const options = {
            "Generate code from a service": autoCodeService_1.autoCodeService,
            "Cli Function 2": autoCodeService_1.autoCodeService,
            "Cli Function 3": autoCodeService_1.autoCodeService,
        };
        const quickPick = vscode_1.window.createQuickPick();
        quickPick.items = Object.keys(options).map((label) => ({ label }));
        quickPick.onDidChangeSelection((selection) => {
            if (selection[0]) {
                options[selection[0].label](context).catch(console.error);
            }
        });
        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
    })));
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map