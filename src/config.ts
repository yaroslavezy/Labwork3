import * as vscode from 'vscode';
import { Mode } from './types';

export interface Settings {
  mode: Mode;
  languages: Set<string>;
  checkOnType: boolean;
  maxFileSizeKb: number;
  workspaceGlob: string;
}

export function readSettings(): Settings {
  const cfg = vscode.workspace.getConfiguration('braceSpace');
  const mode = cfg.get<string>('mode') === 'forbid' ? 'forbid' : 'require';
  return {
    mode,
    languages: new Set(cfg.get<string[]>('languages', ['c', 'cpp', 'java'])),
    checkOnType: cfg.get<boolean>('checkOnType', true),
    maxFileSizeKb: cfg.get<number>('maxFileSizeKb', 2048),
    workspaceGlob: cfg.get<string>('workspaceGlob', '**/*.{c,cc,cpp,cxx,h,hh,hpp,hxx,java}'),
  };
}
