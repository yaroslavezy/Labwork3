import { LineIndex } from './lineIndex';
import { CharClass, classify } from './scanner';
import { CheckOptions, Violation } from './types';

export function findViolations(text: string, options: CheckOptions): Violation[] {
  const mask = classify(text);
  const index = new LineIndex(text);
  const result: Violation[] = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{' || mask[i] !== CharClass.Code) {
      continue;
    }

    let gapStart = i;
    while (
      gapStart > 0 &&
      (text[gapStart - 1] === ' ' || text[gapStart - 1] === '\t') &&
      mask[gapStart - 1] === CharClass.Code
    ) {
      gapStart--;
    }

    const parenOffset = gapStart - 1;
    if (parenOffset < 0 || text[parenOffset] !== ')' || mask[parenOffset] !== CharClass.Code) {
      continue;
    }

    const gap = text.slice(gapStart, i);
    let kind: Violation['kind'] | null = null;
    let replacement = '';

    if (options.mode === 'require') {
      replacement = ' ';
      if (gap === '') {
        kind = 'missing';
      } else if (gap !== ' ') {
        kind = 'extra';
      }
    } else if (gap !== '') {
      kind = 'forbidden';
    }

    if (kind === null) {
      continue;
    }

    result.push({
      kind,
      parenOffset,
      gapStart,
      gapEnd: i,
      bracePos: i,
      line: index.lineOf(parenOffset),
      column: index.columnOf(parenOffset),
      replacement,
    });
  }

  return result;
}

export function applyFixes(text: string, violations: readonly Violation[]): string {
  const parts: string[] = [];
  let cursor = 0;
  for (const v of violations) {
    parts.push(text.slice(cursor, v.gapStart), v.replacement);
    cursor = v.gapEnd;
  }
  parts.push(text.slice(cursor));
  return parts.join('');
}
