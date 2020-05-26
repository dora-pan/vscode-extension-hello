"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
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
exports.autoCodeService = void 0;
const vscode_1 = require("vscode");
const path_1 = require("path");
/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 *
 * This first part uses the helper class `autoCodeService` that wraps the API for the multi-step case.
 */
function autoCodeService(context) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!vscode_1.workspace.workspaceFolders) {
            vscode_1.window.showWarningMessage("No folder or workspace opened!");
            return;
        }
        const resourceGroups = [
            "some-service-1: /service/one",
            "some-service-2: /service/two",
            "some-service-3: /service/three",
            "some-service-4: /service/four",
            "some-service-5: /service/five",
        ].map((label) => ({ label }));
        function collectInputs() {
            return __awaiter(this, void 0, void 0, function* () {
                const state = {};
                yield AutoCode.run((input) => pickResourceGroup(input, state));
                return state;
            });
        }
        const title = "Create some codes from service";
        function pickResourceGroup(input, state) {
            return __awaiter(this, void 0, void 0, function* () {
                const pick = yield input.showQuickPick({
                    title,
                    step: 1,
                    totalSteps: 2,
                    placeholder: "Pick a service",
                    items: resourceGroups,
                    activeItem: typeof state.resourceGroup !== "string"
                        ? state.resourceGroup
                        : undefined,
                    shouldResume: shouldResume,
                });
                state.resourceGroup = pick;
                state.serviceName = state.resourceGroup.label.split(":")[0].trim();
                state.serviceUrl = state.resourceGroup.label.split(":")[1].trim();
                return (input) => inputName(input, state);
            });
        }
        function inputName(input, state) {
            return __awaiter(this, void 0, void 0, function* () {
                const additionalSteps = typeof state.resourceGroup === "string" ? 1 : 0;
                // TODO: Remember current value when navigating back.
                state.name = yield input.showInputBox({
                    title,
                    step: 2 + additionalSteps,
                    totalSteps: 2 + additionalSteps,
                    value: state.name || "serviceA.java",
                    prompt: "Input file name of codes, default: serviceA.java",
                    validate: validateNameIsUnique,
                    shouldResume: shouldResume,
                });
                state.fileName = state.name.split(".")[0];
            });
        }
        function shouldResume() {
            // Could show a notification with the option to resume.
            return new Promise((resolve, reject) => { });
        }
        function validateNameIsUnique(name) {
            return __awaiter(this, void 0, void 0, function* () {
                // ...validate...
                yield new Promise((resolve) => setTimeout(resolve, 1000));
                return name === "vscode" ? "Name not unique" : undefined;
            });
        }
        const state = yield collectInputs();
        const tplData = yield vscode_1.workspace.fs.readFile(vscode_1.Uri.file(context.asAbsolutePath("templates/service.java")));
        vscode_1.window.setStatusBarMessage(`Creating file '${state.name}' from service '${state.serviceName}'`, 3000);
        let tplStr = Buffer.from(tplData).toString("utf8");
        let writeStr = tplStr.replace(/{{(\w+)}}/gim, (data, str) => {
            console.log(str);
            return state[str] + "";
        });
        const writeData = Buffer.from(writeStr, "utf8");
        const folderUri = vscode_1.workspace.workspaceFolders[0].uri;
        const fileUri = folderUri.with({
            path: path_1.posix.join(folderUri.path, state.name),
        });
        yield vscode_1.workspace.fs.writeFile(fileUri, writeData);
        vscode_1.window.setStatusBarMessage(`Create file '${state.name}' from service '${state.serviceName}' successfully!`, 10000);
        vscode_1.window.showTextDocument(fileUri);
    });
}
exports.autoCodeService = autoCodeService;
// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------
let InputFlowAction = /** @class */ (() => {
    class InputFlowAction {
        constructor() { }
    }
    InputFlowAction.back = new InputFlowAction();
    InputFlowAction.cancel = new InputFlowAction();
    InputFlowAction.resume = new InputFlowAction();
    return InputFlowAction;
})();
class AutoCode {
    constructor() {
        this.steps = [];
    }
    static run(start) {
        return __awaiter(this, void 0, void 0, function* () {
            const input = new AutoCode();
            return input.stepThrough(start);
        });
    }
    stepThrough(start) {
        return __awaiter(this, void 0, void 0, function* () {
            let step = start;
            while (step) {
                this.steps.push(step);
                if (this.current) {
                    this.current.enabled = false;
                    this.current.busy = true;
                }
                try {
                    step = yield step(this);
                }
                catch (err) {
                    if (err === InputFlowAction.back) {
                        this.steps.pop();
                        step = this.steps.pop();
                    }
                    else if (err === InputFlowAction.resume) {
                        step = this.steps.pop();
                    }
                    else if (err === InputFlowAction.cancel) {
                        step = undefined;
                    }
                    else {
                        throw err;
                    }
                }
            }
            if (this.current) {
                this.current.dispose();
            }
        });
    }
    showQuickPick({ title, step, totalSteps, items, activeItem, placeholder, buttons, shouldResume, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const disposables = [];
            try {
                return yield new Promise((resolve, reject) => {
                    const input = vscode_1.window.createQuickPick();
                    input.title = title;
                    input.step = step;
                    input.totalSteps = totalSteps;
                    input.placeholder = placeholder;
                    input.items = items;
                    if (activeItem) {
                        input.activeItems = [activeItem];
                    }
                    input.buttons = [
                        ...(this.steps.length > 1 ? [vscode_1.QuickInputButtons.Back] : []),
                        ...(buttons || []),
                    ];
                    disposables.push(input.onDidTriggerButton((item) => {
                        if (item === vscode_1.QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        }
                        else {
                            resolve(item);
                        }
                    }), input.onDidChangeSelection((items) => resolve(items[0])), input.onDidHide(() => {
                        (() => __awaiter(this, void 0, void 0, function* () {
                            reject(shouldResume && (yield shouldResume())
                                ? InputFlowAction.resume
                                : InputFlowAction.cancel);
                        }))().catch(reject);
                    }));
                    if (this.current) {
                        this.current.dispose();
                    }
                    this.current = input;
                    this.current.show();
                });
            }
            finally {
                disposables.forEach((d) => d.dispose());
            }
        });
    }
    showInputBox({ title, step, totalSteps, value, prompt, validate, buttons, shouldResume, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const disposables = [];
            try {
                return yield new Promise((resolve, reject) => {
                    const input = vscode_1.window.createInputBox();
                    input.title = title;
                    input.step = step;
                    input.totalSteps = totalSteps;
                    input.value = value || "";
                    input.prompt = prompt;
                    input.buttons = [
                        ...(this.steps.length > 1 ? [vscode_1.QuickInputButtons.Back] : []),
                        ...(buttons || []),
                    ];
                    let validating = validate("");
                    disposables.push(input.onDidTriggerButton((item) => {
                        if (item === vscode_1.QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        }
                        else {
                            resolve(item);
                        }
                    }), input.onDidAccept(() => __awaiter(this, void 0, void 0, function* () {
                        const value = input.value;
                        input.enabled = false;
                        input.busy = true;
                        if (!(yield validate(value))) {
                            resolve(value);
                        }
                        input.enabled = true;
                        input.busy = false;
                    })), input.onDidChangeValue((text) => __awaiter(this, void 0, void 0, function* () {
                        const current = validate(text);
                        validating = current;
                        const validationMessage = yield current;
                        if (current === validating) {
                            input.validationMessage = validationMessage;
                        }
                    })), input.onDidHide(() => {
                        (() => __awaiter(this, void 0, void 0, function* () {
                            reject(shouldResume && (yield shouldResume())
                                ? InputFlowAction.resume
                                : InputFlowAction.cancel);
                        }))().catch(reject);
                    }));
                    if (this.current) {
                        this.current.dispose();
                    }
                    this.current = input;
                    this.current.show();
                });
            }
            finally {
                disposables.forEach((d) => d.dispose());
            }
        });
    }
}
//# sourceMappingURL=autoCodeService.js.map