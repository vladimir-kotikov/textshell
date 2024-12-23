import { match } from 'ts-pattern';
import * as vscode from 'vscode';

export type Command = (lines: string[]) => string[];
export type CommandFactory = (args: string[]) => Command;

const collator = new Intl.Collator(undefined, { numeric: true, usage: 'sort' });

export const NOOP: Command = (lines) => lines;
export const sort: CommandFactory = (args) => {
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
};

export const uniq: CommandFactory = (args) => {
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
};

export const help: CommandFactory = () => (lines) => {
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
};

export default {
  sort,
  uniq,
  help,
};
