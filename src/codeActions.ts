import * as vscode from 'vscode';
import { DIAGNOSTIC_SOURCE, DiagnosticsManager } from './diagnostics';
import { Violation } from './types';

function gapRange(document: vscode.TextDocument, v: Violation): vscode.Range {
  return new vscode.Range(document.positionAt(v.gapStart), document.positionAt(v.gapEnd));
}

export function buildFixEdit(
  document: vscode.TextDocument,
  violations: readonly Violation[],
): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();
  for (const v of violations) {
    edit.replace(document.uri, gapRange(document, v), v.replacement);
  }
  return edit;
}

export class BraceSpaceCodeActionProvider implements vscode.CodeActionProvider {
  static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
  };

  constructor(private readonly manager: DiagnosticsManager) {}

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    if (!this.manager.isSupported(document)) {
      return [];
    }

    const violations = this.manager.analyze(document);
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== DIAGNOSTIC_SOURCE) {
        continue;
      }
      const violation = violations.find((v) =>
        document.positionAt(v.parenOffset).isEqual(diagnostic.range.start),
      );
      if (!violation) {
        continue;
      }

      const title =
        violation.replacement === ''
          ? 'Убрать пробелы между ) и {'
          : 'Поставить один пробел между ) и {';
      const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
      action.diagnostics = [diagnostic];
      action.isPreferred = true;
      action.edit = buildFixEdit(document, [violation]);
      actions.push(action);
    }

    if (actions.length > 0 && violations.length > 1) {
      const all = new vscode.CodeAction(
        `Исправить все нарушения в файле (${violations.length})`,
        vscode.CodeActionKind.QuickFix,
      );
      all.edit = buildFixEdit(document, violations);
      actions.push(all);
    }

    return actions;
  }
}
