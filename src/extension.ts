import { window, commands, ExtensionContext } from "vscode";
import { autoCodeService } from "./autoCodeService";

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand("hello.helloCli", async () => {
      const options: {
        [key: string]: (context: ExtensionContext) => Promise<void>;
      } = {
        "Generate code from a service": autoCodeService,
        "Cli Function 2": autoCodeService,
        "Cli Function 3": autoCodeService,
      };
      const quickPick = window.createQuickPick();
      quickPick.items = Object.keys(options).map((label) => ({ label }));
      quickPick.onDidChangeSelection((selection) => {
        if (selection[0]) {
          options[selection[0].label](context).catch(console.error);
        }
      });
      quickPick.onDidHide(() => quickPick.dispose());
      quickPick.show();
    })
  );
}
