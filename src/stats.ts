import { Violation, ViolationKind } from './types';

export interface Report {
  total: number;
  byKind: Map<ViolationKind, number>;
  byLine: Map<number, Violation[]>;
}

export function buildReport(violations: readonly Violation[]): Report {
  const byKind = new Map<ViolationKind, number>();
  const byLine = new Map<number, Violation[]>();

  for (const v of violations) {
    byKind.set(v.kind, (byKind.get(v.kind) ?? 0) + 1);
    const list = byLine.get(v.line);
    if (list) {
      list.push(v);
    } else {
      byLine.set(v.line, [v]);
    }
  }

  return { total: violations.length, byKind, byLine };
}

export const KIND_TITLES: Record<ViolationKind, string> = {
  missing: 'нет пробела между ) и {',
  extra: 'лишние пробелы или табуляция между ) и {',
  forbidden: 'пробел между ) и { запрещён правилом',
};

export function formatReport(title: string, report: Report): string {
  const lines: string[] = [`Файл: ${title}`];
  if (report.total === 0) {
    lines.push('Нарушений не найдено.');
    return lines.join('\n');
  }
  lines.push(`Всего нарушений: ${report.total}`);
  for (const [kind, count] of report.byKind) {
    lines.push(`  - ${KIND_TITLES[kind]}: ${count}`);
  }
  lines.push('Строки с нарушениями:');
  for (const [line, list] of report.byLine) {
    lines.push(`  ${line + 1}: ${list.length}`);
  }
  return lines.join('\n');
}
