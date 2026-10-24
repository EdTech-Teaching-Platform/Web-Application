export function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(headers, rows, lineEnding = "\r\n") {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join(lineEnding);
}
