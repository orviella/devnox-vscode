/** Shared by the browser preview and the Telegram worker: no first-recipient state. */
export function personalizeTemplate(text, values = {}) {
  return String(text ?? "").replace(
    /\{\{(nome|empresa|link)\}\}|\{(nome|empresa|link)\}/g,
    (_, doubleKey, singleKey) => String(values[doubleKey || singleKey] ?? ""),
  );
}
