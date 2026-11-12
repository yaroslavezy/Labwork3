export const CharClass = {
  Code: 0,
  Comment: 1,
  Literal: 2,
} as const;

const RAW_PREFIXES = new Set(['R', 'LR', 'uR', 'UR', 'u8R']);

function isIdentChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 95 // _
  );
}

function wordBefore(text: string, end: number): string {
  let start = end;
  while (start > 0 && isIdentChar(text.charCodeAt(start - 1))) {
    start--;
  }
  return text.slice(start, end);
}

function lineCommentEnd(text: string, from: number): number {
  let j = from;
  while (j < text.length && text[j] !== '\n') {
    if (text[j] === '\\') {
      if (text[j + 1] === '\n') {
        j += 2;
        continue;
      }
      if (text[j + 1] === '\r' && text[j + 2] === '\n') {
        j += 3;
        continue;
      }
    }
    j++;
  }
  return j;
}

function rawStringEnd(text: string, quotePos: number): number {
  if (!RAW_PREFIXES.has(wordBefore(text, quotePos))) {
    return -1;
  }
  let j = quotePos + 1;
  while (j < text.length && j - quotePos <= 17 && !'() \\\t\r\n'.includes(text[j])) {
    j++;
  }
  if (text[j] !== '(') {
    return -1;
  }
  const delimiter = text.slice(quotePos + 1, j);
  const closing = ')' + delimiter + '"';
  const idx = text.indexOf(closing, j + 1);
  return idx < 0 ? text.length : idx + closing.length;
}

export function classify(text: string): Uint8Array {
  const n = text.length;
  const mask = new Uint8Array(n); 
  let i = 0;

  const mark = (from: number, to: number, cls: number): void => {
    mask.fill(cls, from, Math.min(to, n));
  };

  while (i < n) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '/' && next === '/') {
      const end = lineCommentEnd(text, i + 2);
      mark(i, end, CharClass.Comment);
      i = end;
      continue;
    }

    if (c === '/' && next === '*') {
      const idx = text.indexOf('*/', i + 2);
      const end = idx < 0 ? n : idx + 2;
      mark(i, end, CharClass.Comment);
      i = end;
      continue;
    }

    if (c === '"') {
      const raw = rawStringEnd(text, i);
      if (raw >= 0) {
        mark(i, raw, CharClass.Literal);
        i = raw;
        continue;
      }
    }

    if (c === "'") {
      const word = wordBefore(text, i);
      if (word.length > 0 && word.charCodeAt(0) >= 48 && word.charCodeAt(0) <= 57) {
        i++;
        continue;
      }
    }

    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\') {
          j += 2; 
        } else if (text[j] === c) {
          j++;
          break;
        } else if (text[j] === '\n') {
          break; 
        } else {
          j++;
        }
      }
      mark(i, j, CharClass.Literal);
      i = Math.min(j, n);
      continue;
    }

    i++;
  }

  return mask;
}
