/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  QuickPickItem,
  window,
  Disposable,
  CancellationToken,
  QuickInputButton,
  QuickInput,
  ExtensionContext,
  QuickInputButtons,
  Uri,
  workspace,
  WorkspaceEdit,
} from "vscode";
import { posix } from "path";

/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 *
 * This first part uses the helper class `autoCodeService` that wraps the API for the multi-step case.
 */
export async function autoCodeService(context: ExtensionContext) {
  if (!workspace.workspaceFolders) {
    window.showWarningMessage("No folder or workspace opened!");
    return;
  }
  const resourceGroups: QuickPickItem[] = [
    "some-service-1: /service/one",
    "some-service-2: /service/two",
    "some-service-3: /service/three",
    "some-service-4: /service/four",
    "some-service-5: /service/five",
  ].map((label) => ({ label }));

  interface State {
    title: string;
    step: number;
    totalSteps: number;
    resourceGroup: QuickPickItem | string;
    name: string;
    serviceName: string;
    serviceUrl: string;
    [propName: string]: string | number | QuickPickItem;
  }

  async function collectInputs() {
    const state = {} as Partial<State>;
    await AutoCode.run((input) => pickResourceGroup(input, state));
    return state as State;
  }

  const title = "Create some codes from service";

  async function pickResourceGroup(input: AutoCode, state: Partial<State>) {
    const pick = await input.showQuickPick({
      title,
      step: 1,
      totalSteps: 2,
      placeholder: "Pick a service",
      items: resourceGroups,
      activeItem:
        typeof state.resourceGroup !== "string"
          ? state.resourceGroup
          : undefined,
      shouldResume: shouldResume,
    });
    state.resourceGroup = pick;
    state.serviceName = state.resourceGroup.label.split(":")[0].trim();
    state.serviceUrl = state.resourceGroup.label.split(":")[1].trim();
    return (input: AutoCode) => inputName(input, state);
  }

  async function inputName(input: AutoCode, state: Partial<State>) {
    const additionalSteps = typeof state.resourceGroup === "string" ? 1 : 0;
    // TODO: Remember current value when navigating back.
    state.name = await input.showInputBox({
      title,
      step: 2 + additionalSteps,
      totalSteps: 2 + additionalSteps,
      value: state.name || "serviceA.java",
      prompt: "Input file name of codes, default: serviceA.java",
      validate: validateNameIsUnique,
      shouldResume: shouldResume,
    });
    state.fileName = state.name.split(".")[0];
  }

  function shouldResume() {
    // Could show a notification with the option to resume.
    return new Promise<boolean>((resolve, reject) => {});
  }

  async function validateNameIsUnique(name: string) {
    // ...validate...
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return name === "vscode" ? "Name not unique" : undefined;
  }

  const state = await collectInputs();

  const tplData = await workspace.fs.readFile(
    Uri.file(context.asAbsolutePath("templates/service.java"))
  );
  window.setStatusBarMessage(
    `Creating file '${state.name}' from service '${state.serviceName}'`,
    3000
  );
  let tplStr = Buffer.from(tplData).toString("utf8");
  let writeStr = tplStr.replace(/{{(\w+)}}/gim, (data, str: string) => {
    console.log(str);
    return state[str] + "";
  });
  const writeData = Buffer.from(writeStr, "utf8");
  const folderUri = workspace.workspaceFolders[0].uri;
  const fileUri = folderUri.with({
    path: posix.join(folderUri.path, state.name),
  });

  await workspace.fs.writeFile(fileUri, writeData);

  window.setStatusBarMessage(
    `Create file '${state.name}' from service '${state.serviceName}' successfully!`,
    10000
  );
  window.showTextDocument(fileUri);
}

// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------

class InputFlowAction {
  private constructor() {}
  static back = new InputFlowAction();
  static cancel = new InputFlowAction();
  static resume = new InputFlowAction();
}

type InputStep = (input: AutoCode) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
  title: string;
  step: number;
  totalSteps: number;
  items: T[];
  activeItem?: T;
  placeholder: string;
  buttons?: QuickInputButton[];
  shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
  title: string;
  step: number;
  totalSteps: number;
  value: string;
  prompt: string;
  validate: (value: string) => Promise<string | undefined>;
  buttons?: QuickInputButton[];
  shouldResume: () => Thenable<boolean>;
}

class AutoCode {
  static async run<T>(start: InputStep) {
    const input = new AutoCode();
    return input.stepThrough(start);
  }

  private current?: QuickInput;
  private steps: InputStep[] = [];

  private async stepThrough<T>(start: InputStep) {
    let step: InputStep | void = start;
    while (step) {
      this.steps.push(step);
      if (this.current) {
        this.current.enabled = false;
        this.current.busy = true;
      }
      try {
        step = await step(this);
      } catch (err) {
        if (err === InputFlowAction.back) {
          this.steps.pop();
          step = this.steps.pop();
        } else if (err === InputFlowAction.resume) {
          step = this.steps.pop();
        } else if (err === InputFlowAction.cancel) {
          step = undefined;
        } else {
          throw err;
        }
      }
    }
    if (this.current) {
      this.current.dispose();
    }
  }

  async showQuickPick<
    T extends QuickPickItem,
    P extends QuickPickParameters<T>
  >({
    title,
    step,
    totalSteps,
    items,
    activeItem,
    placeholder,
    buttons,
    shouldResume,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<
        T | (P extends { buttons: (infer I)[] } ? I : never)
      >((resolve, reject) => {
        const input = window.createQuickPick<T>();
        input.title = title;
        input.step = step;
        input.totalSteps = totalSteps;
        input.placeholder = placeholder;
        input.items = items;
        if (activeItem) {
          input.activeItems = [activeItem];
        }
        input.buttons = [
          ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
          ...(buttons || []),
        ];
        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              reject(InputFlowAction.back);
            } else {
              resolve(<any>item);
            }
          }),
          input.onDidChangeSelection((items) => resolve(items[0])),
          input.onDidHide(() => {
            (async () => {
              reject(
                shouldResume && (await shouldResume())
                  ? InputFlowAction.resume
                  : InputFlowAction.cancel
              );
            })().catch(reject);
          })
        );
        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }

  async showInputBox<P extends InputBoxParameters>({
    title,
    step,
    totalSteps,
    value,
    prompt,
    validate,
    buttons,
    shouldResume,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<
        string | (P extends { buttons: (infer I)[] } ? I : never)
      >((resolve, reject) => {
        const input = window.createInputBox();
        input.title = title;
        input.step = step;
        input.totalSteps = totalSteps;
        input.value = value || "";
        input.prompt = prompt;
        input.buttons = [
          ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
          ...(buttons || []),
        ];
        let validating = validate("");
        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              reject(InputFlowAction.back);
            } else {
              resolve(<any>item);
            }
          }),
          input.onDidAccept(async () => {
            const value = input.value;
            input.enabled = false;
            input.busy = true;
            if (!(await validate(value))) {
              resolve(value);
            }
            input.enabled = true;
            input.busy = false;
          }),
          input.onDidChangeValue(async (text) => {
            const current = validate(text);
            validating = current;
            const validationMessage = await current;
            if (current === validating) {
              input.validationMessage = validationMessage;
            }
          }),
          input.onDidHide(() => {
            (async () => {
              reject(
                shouldResume && (await shouldResume())
                  ? InputFlowAction.resume
                  : InputFlowAction.cancel
              );
            })().catch(reject);
          })
        );
        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }
}
