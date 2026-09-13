/** Escapes a single CSV field per RFC 4180: wrap in quotes if it contains a
 * comma, quote, or newline, doubling any internal quotes. */
function escapeField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a CSV string from column definitions and rows, then triggers a
 * browser download. Done entirely client-side against data already fetched
 * for the page - no export endpoint needed for lists this size.
 */
export function downloadCsv<T>(filename: string, columns: { header: string; value: (row: T) => unknown }[], rows: T[]): void {
  const lines = [
    columns.map((c) => escapeField(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escapeField(c.value(row))).join(',')),
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
