export type Mode = 'require' | 'forbid';

export type ViolationKind = 'missing' | 'extra' | 'forbidden';

export interface CheckOptions {
  mode: Mode;
}

export interface Violation {
  kind: ViolationKind;
  parenOffset: number;
  gapStart: number;
  gapEnd: number;
  bracePos: number;
  line: number;
  column: number;
  replacement: string;
}
