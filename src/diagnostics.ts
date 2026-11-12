import * as vscode from 'vscode';
import { findViolations } from './checker';
import { readSettings } from './config';
import { KIND_TITLES } from './stats';
import { Violation } from './types';

export const DIAGNOSTIC_SOURCE = 'Brace Space';

const DEBOUNCE_MS = 300;

export class DiagnosticsManager implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('braceSpace');
  private readonly cache = new Map<string, Violation[]>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly updateEmitter = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidUpdate: vscode.Event<vscode.Uri> = this.updateEmitter.event;

  isSupported(document: vscode.TextDocument): boolean {
    const settings = readSettings();
    return (
      settings.languages.has(document.languageId) &&
      document.getText().length <= settings.maxFileSizeKb * 1024
    );
  }

  analyze(document: vscode.TextDocument): Violation[] {
    if (!this.isSupported(document)) {
      return [];
    }
    return findViolations(document.getText(), { mode: readSettings().mode });
  }

  getViolations(document: vscode.TextDocument): Violation[] {
    return this.cache.get(document.uri.toString()) ?? [];
  }

  refresh(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    this.cancelTimer(key);

    if (!this.isSupported(document)) {
      this.clear(document);
      return;
    }

    const violations = this.analyze(document);
    this.cache.set(key, violations);
    this.collection.set(
      document.uri,
      violations.map((v) => this.toDiagnostic(document, v)),
    );
    this.updateEmitter.fire(document.uri);
  }

  schedule(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    this.cancelTimer(key);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.refresh(document);
      }, DEBOUNCE_MS),
    );
  }

  refreshAll(): void {
    for (const doc of vscode.workspace.textDocuments) {
      this.refresh(doc);
    }
  }

  clear(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    this.cancelTimer(key);
    this.cache.delete(key);
    this.collection.delete(document.uri);
    this.updateEmitter.fire(document.uri);
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
    this.collection.dispose();
    this.updateEmitter.dispose();
  }

  private cancelTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  private toDiagnostic(document: vscode.TextDocument, v: Violation): vscode.Diagnostic {
    const range = new vscode.Range(
      document.positionAt(v.parenOffset),
      document.positionAt(v.bracePos + 1),
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      KIND_TITLES[v.kind],
      vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = v.kind;
    return diagnostic;
  }
}
