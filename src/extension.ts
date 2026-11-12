import * as vscode from 'vscode';
import { findViolations } from './checker';
import { BraceSpaceCodeActionProvider, buildFixEdit } from './codeActions';
import { readSettings } from './config';
import { DiagnosticsManager } from './diagnostics';
import { buildReport, formatReport } from './stats';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new DiagnosticsManager();
  const output = vscode.window.createOutputChannel('Brace Space Checker');

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = 'braceSpace.showReport';

  const updateStatus = (): void => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !manager.isSupported(editor.document)) {
      status.hide();
      return;
    }
    const count = manager.getViolations(editor.document).length;
    status.text = count === 0 ? '$(check) Brace Space' : `$(warning) Brace Space: ${count}`;
    status.tooltip =
      count === 0 ? 'Нарушений стиля скобок нет' : 'Нажмите, чтобы открыть отчёт по файлу';
    status.show();
  };

  const fixAll = vscode.commands.registerCommand('braceSpace.fixAll', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage('Brace Space: нет открытого файла.');
      return;
    }
    const violations = manager.analyze(editor.document);
    if (violations.length === 0) {
      void vscode.window.showInformationMessage('Brace Space: нарушений не найдено.');
      return;
    }
    const ok = await vscode.workspace.applyEdit(buildFixEdit(editor.document, violations));
    if (ok) {
      manager.refresh(editor.document);
      void vscode.window.showInformationMessage(`Brace Space: исправлено ${violations.length}.`);
    }
  });

  const showReport = vscode.commands.registerCommand('braceSpace.showReport', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage('Brace Space: нет открытого файла.');
      return;
    }
    const report = buildReport(manager.analyze(editor.document));
    output.clear();
    output.appendLine(formatReport(editor.document.fileName, report));
    output.show(true);
  });

  const checkWorkspace = vscode.commands.registerCommand('braceSpace.checkWorkspace', () =>
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Brace Space: проверка проекта',
        cancellable: true,
      },
      async (progress, token) => {
        const settings = readSettings();
        const files = await vscode.workspace.findFiles(
          settings.workspaceGlob,
          '**/{node_modules,out,build,dist,.git}/**',
        );
        if (files.length === 0) {
          void vscode.window.showInformationMessage('Brace Space: подходящих файлов не найдено.');
          return;
        }

        const decoder = new TextDecoder('utf-8');
        const counts = new Map<string, number>(); 
        let total = 0;
        let skipped = 0;
        let processed = 0;

        for (const uri of files) {
          if (token.isCancellationRequested) {
            break;
          }
          const bytes = await vscode.workspace.fs.readFile(uri);
          if (bytes.byteLength > settings.maxFileSizeKb * 1024) {
            skipped++;
          } else {
            const found = findViolations(decoder.decode(bytes), { mode: settings.mode });
            if (found.length > 0) {
              counts.set(vscode.workspace.asRelativePath(uri), found.length);
              total += found.length;
            }
          }
          processed++;
          progress.report({ increment: 100 / files.length, message: `${processed}/${files.length}` });
        }

        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

        output.clear();
        output.appendLine(`Проверено файлов: ${processed} из ${files.length}`);
        if (skipped > 0) {
          output.appendLine(`Пропущено из-за размера: ${skipped}`);
        }
        output.appendLine(`Файлов с нарушениями: ${sorted.length}`);
        output.appendLine(`Всего нарушений: ${total}`);
        for (const [path, count] of sorted) {
          output.appendLine(`  ${count}\t${path}`);
        }
        output.show(true);
      },
    ),
  );

  context.subscriptions.push(
    manager,
    output,
    status,
    fixAll,
    showReport,
    checkWorkspace,
    manager.onDidUpdate(updateStatus),
    vscode.languages.registerCodeActionsProvider(
      [{ scheme: 'file' }, { scheme: 'untitled' }],
      new BraceSpaceCodeActionProvider(manager),
      BraceSpaceCodeActionProvider.metadata,
    ),
    vscode.workspace.onDidOpenTextDocument((doc) => manager.refresh(doc)),
    vscode.workspace.onDidSaveTextDocument((doc) => manager.refresh(doc)),
    vscode.workspace.onDidCloseTextDocument((doc) => manager.clear(doc)),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (readSettings().checkOnType) {
        manager.schedule(e.document);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(updateStatus),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('braceSpace')) {
        manager.refreshAll();
        updateStatus();
      }
    }),
  );

  manager.refreshAll();
  updateStatus();
}

export function deactivate(): void {
}
