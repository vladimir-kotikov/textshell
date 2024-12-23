import * as vscode from 'vscode';
import { NOOP, Pipe, PipeFactory, help, sort, uniq } from './pipes';

const PIPES: Record<string, PipeFactory> = {
  help,
  sort,
  uniq,
};

const ensureError = (e: any): Error => (e instanceof Error ? e : new Error(e));

const getTextLines = (editor?: vscode.TextEditor): [string[], vscode.Range] => {
  if (!editor) {
    return [[], new vscode.Range(0, 0, 0, 0)];
  }

  const { start, end } = editor.selection;
  const newSelection = new vscode.Range(
    start.line,
    0,
    end.line,
    editor.document.lineAt(end.line).text.length,
  );
  return [editor.document.getText(newSelection).split('\n'), newSelection];
};

const parsePipe = (text: string): Pipe => {
  const [pipeName, ...args] = text.trim().split(/\s+/);
  const factory = PIPES[pipeName];
  if (!factory) {
    throw new Error(`Unknown command: ${pipeName}`);
  }

  return factory(args);
};

const parsePipeline = (
  text: string,
  { check = false } = {},
): [Pipe, null] | [null, Error] => {
  let pipes: Pipe[] = [];
  try {
    pipes = text
      .split('|')
      .map((c) => c.trim())
      .map(parsePipe);
  } catch (e) {
    return [null, ensureError(e)];
  }

  if (check || pipes.length === 0) {
    return [NOOP, null];
  }

  const pipeline = (lines: string[]) =>
    pipes.reduce((inp, pipe) => pipe(inp), lines);
  return [pipeline, null];
};

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'textshell.executeCommand',
    async () => {
      // TODO: Command history
      // TODO: hotkey
      // TODO: autocomplete/hints
      // TODO: inline (in-list) command help
      // TODO: commands: shuffle, quote, suff, join, split, zip/unzip, tabulate, pick, sample, head, tail, pipe (> filename/current), rand, uuid...
      // TODO: in-editor preview/prompt
      // TODO: different errors: command parse - red, missing command in the middle - yellow, missing last command - green
      // TODO: aliases
      const cmdText = await vscode.window.showInputBox({
        placeHolder: 'Enter your command',
        prompt:
          "Enter command or commands, separated by pipe (|). For the list of available commands, type 'help' <Enter>.",
        ignoreFocusOut: true,
        validateInput: (inp) => {
          const [_, err] = parsePipeline(inp, { check: true });
          return err
            ? {
                message: err.message,
                severity: vscode.InputBoxValidationSeverity.Warning,
              }
            : null;
        },
      });

      if (!cmdText) {
        return;
      }

      // TODO: cache the parsed pipeline in the validation routine
      const [pipe, error] = parsePipeline(cmdText);
      if (error) {
        vscode.window.showErrorMessage(error.message);
        return;
      }

      const [lines, selection] = getTextLines(vscode.window.activeTextEditor);
      const out = pipe(lines);
      if (vscode.window.activeTextEditor) {
        const editor = vscode.window.activeTextEditor;
        editor.edit((editBuilder) => {
          editBuilder.replace(selection, out.join('\n'));
        });
      }
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
