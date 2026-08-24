import * as vscode from "vscode";
import { delimiter } from "node:path";
import process from "node:process";
import { ensureCliLauncher } from "./cli-launcher.ts";
import { createMarkdownItExtender } from "./markdown.ts";
import { registerToposCommands } from "./commands.ts";
import { ToposViewerProvider } from "./viewer-provider.ts";
import { ToposEditorProvider } from "./editor-provider.ts";
import { registerStatusBar } from "./status-bar.ts";
import { ViewerWebview } from "./viewer-webview.ts";
import { registerToposCompletions } from "./completions.ts";

const extendMarkdownIt = createMarkdownItExtender();

export async function activate(
  context: vscode.ExtensionContext,
): Promise<{ extendMarkdownIt: typeof extendMarkdownIt }> {
  context.environmentVariableCollection.description = "Makes the Topos CLI available in new integrated terminals.";
  context.environmentVariableCollection.clear();
  try {
    const cli = await ensureCliLauncher({
      storagePath: context.globalStorageUri.fsPath,
      extensionPath: context.extensionUri.fsPath,
      runtimePath: process.execPath,
    });
    context.environmentVariableCollection.append(
      "PATH",
      `${delimiter}${cli.binPath}`,
    );
  } catch (error) {
    console.error("Unable to create the external Topos CLI launcher", error);
    const extensionBin = vscode.Uri.joinPath(context.extensionUri, "bin").fsPath;
    context.environmentVariableCollection.append(
      "PATH",
      `${delimiter}${extensionBin}`,
    );
    context.environmentVariableCollection.replace(
      "TOPOS_RUNTIME",
      process.execPath,
    );
    context.environmentVariableCollection.replace(
      "TOPOS_SCRIPT",
      vscode.Uri.joinPath(context.extensionUri, "out", "topos.js").fsPath,
    );
  }

  registerStatusBar(context);
  ViewerWebview.register(context);
  context.subscriptions.push(
    ToposViewerProvider.register(context.extensionUri),
  );
  context.subscriptions.push(ToposEditorProvider.register(context));
  context.subscriptions.push(...registerToposCommands(context));
  context.subscriptions.push(registerToposCompletions());
  return { extendMarkdownIt };
}

export function deactivate(): void {}
