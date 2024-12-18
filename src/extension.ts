import { match } from 'ts-pattern';
import * as vscode from 'vscode';

type Command = (lines: string[]) => string[];
type CommandFactory = (args: string[]) => Command;

const collator = new Intl.Collator(undefined, { numeric: true, usage: 'sort' });

const NOOP: Command = (lines) => lines;
const COMMANDS: Record<string, CommandFactory> = {
  sort: (args) => {
    const comparator = match(args)
      .with([], ['asc'], () => collator.compare)
      .with(
        ['-d'],
        ['desc'],
        () => (a: string, b: string) => -collator.compare(a, b),
      )
      .otherwise(() => {
        throw new Error('Invalid arguments');
      });

    return (lines) => lines.toSorted(comparator);
  },
  uniq: (args) => {
    if (args.length > 0) {
      throw new Error('Invalid arguments');
    }

    return (lines) => {
      const uniques = lines.reduce<Record<string, true>>((acc, line) => {
        acc[line] = true;
        return acc;
      }, {});

      return Object.keys(uniques);
    };
  },
  help: () => (lines) => {
    vscode.window
      .showTextDocument(vscode.Uri.parse('untitled:textshell.md'))
      .then((editor) => {
        editor.edit((editBuilder) => {
          editBuilder.insert(
            new vscode.Position(0, 0),
            `
					# Available commands
					- sort: Sorts the lines
					- help: Shows this help
				`,
          );
        });
      });
    return lines;
  },
};

const ensureError = (e: any): Error => {
  if (e instanceof Error) {
    return e;
  } else {
    return new Error(e);
  }
};

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

const parseCommand = (cmdText: string): Command => {
  const [cmdName, ...args] = cmdText.trim().split(/\s+/);
  const factory = COMMANDS[cmdName];
  if (!factory) {
    throw new Error(`Unknown command: ${cmdName}`);
  }

  return factory(args);
};

const parseCommandLine = (
  cmdText: string,
  { check = false } = {},
): [Command, null] | [null, Error] => {
  let commands: Command[] = [];
  try {
    commands = cmdText
      .split('|')
      .map((c) => c.trim())
      .map(parseCommand);
  } catch (e) {
    return [null, ensureError(e)];
  }

  if (check || commands.length === 0) {
    return [NOOP, null];
  }

  const pipeline = (lines: string[]) =>
    commands.reduce((inp, cmd) => cmd(inp), lines);
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
          const [_, err] = parseCommandLine(inp, { check: true });
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

      const [cmd, error] = parseCommandLine(cmdText);
      if (error) {
        vscode.window.showErrorMessage(error.message);
        return;
      }

      const [lines, selection] = getTextLines(vscode.window.activeTextEditor);
      const out = cmd(lines);
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

export function deactivate() { }
