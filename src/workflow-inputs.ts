/**
 * Los inputs de los workflows reutilizables de star, leídos como texto (no hay
 * un parser de YAML en el kit, y estos archivos tienen una forma fija).
 */

const indentOf = (line: string): number => line.length - line.trimStart().length;
const isSkippable = (line: string): boolean => line.trim() === "" || line.trim().startsWith("#");

/** Las claves hijas directas de la línea `start` (las de una sola sangría más profunda). */
function childKeys(lines: string[], start: number, end = lines.length): string[] {
  const parent = indentOf(lines[start] ?? "");
  const keys: string[] = [];
  let level: number | null = null;
  for (let i = start + 1; i < end; i++) {
    const line = lines[i] ?? "";
    if (isSkippable(line)) continue;
    const indent = indentOf(line);
    if (indent <= parent) break;
    level ??= indent;
    const key = indent === level ? /^\s*["']?([\w-]+)["']?\s*:/.exec(line)?.[1] : undefined;
    if (key) keys.push(key);
  }
  return keys;
}

/** Los inputs que declara un workflow en `on.workflow_call.inputs`. */
export function declaredInputs(workflow: string): string[] {
  const lines = workflow.split(/\r?\n/);
  const call = lines.findIndex((l) => /^\s*workflow_call\s*:/.test(l));
  if (call === -1) return [];
  const parent = indentOf(lines[call] ?? "");
  for (let i = call + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (isSkippable(line)) continue;
    if (indentOf(line) <= parent) break;
    if (/^\s*inputs\s*:/.test(line)) return childKeys(lines, i);
  }
  return [];
}

export type StarWorkflowUse = {
  /** El archivo del workflow de star: `web-release.yml`. */
  file: string;
  /** La versión sin la v: `0.7.0`. */
  version: string;
  /** Las claves de `with:` del job que lo usa. */
  inputs: string[];
};

/**
 * Los jobs de una app que llaman a un workflow de star
 * (`uses: baironvillar/star/.github/workflows/x.yml@v0.7.0`), con lo que le
 * pasan en `with:`.
 */
export function starWorkflowUses(text: string): StarWorkflowUse[] {
  const lines = text.split(/\r?\n/);
  const found: StarWorkflowUse[] = [];
  lines.forEach((line, at) => {
    const m = /^(\s*)uses:\s*baironvillar\/star\/\.github\/workflows\/([\w.-]+)@v(\S+)/.exec(line);
    if (!m) return;
    const indent = (m[1] ?? "").length;
    // El job son las líneas contiguas con esa sangría o más profunda.
    let from = at;
    while (
      from > 0 &&
      (isSkippable(lines[from - 1] ?? "") || indentOf(lines[from - 1] ?? "") >= indent)
    )
      from--;
    let to = at + 1;
    while (
      to < lines.length &&
      (isSkippable(lines[to] ?? "") || indentOf(lines[to] ?? "") >= indent)
    )
      to++;
    const withAt = lines
      .slice(from, to)
      .findIndex((l) => indentOf(l) === indent && /^\s*with\s*:/.test(l));
    const block = lines.slice(from, to);
    found.push({
      file: m[2] ?? "",
      version: m[3] ?? "",
      inputs: withAt === -1 ? [] : childKeys(block, withAt),
    });
  });
  return found;
}
