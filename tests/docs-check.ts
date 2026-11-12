import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-test", ".git"]);

export function markdownFiles(root: string, dir = root): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) out.push(...markdownFiles(root, join(dir, e.name)));
    } else if (e.name.endsWith(".md")) {
      out.push(join(dir, e.name));
    }
  }
  return out.sort();
}

/** Relative links in `file` whose target does not exist. */
export function brokenLinks(root: string, file: string): string[] {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  const problems: string[] = [];
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) {
    const target = m[1]!;
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
    const path = decodeURIComponent(target.split("#")[0]!.split("?")[0]!);
    if (path === "") continue;
    if (!existsSync(join(dirname(file), path))) {
      problems.push(`${relative(root, file)}: broken link ${target}`);
    }
  }
  return problems;
}

function makeTargets(root: string): Set<string> {
  const mk = join(root, "Makefile");
  if (!existsSync(mk)) return new Set();
  const targets = new Set<string>();
  for (const m of readFileSync(mk, "utf8").matchAll(/^([A-Za-z0-9_.-]+)\s*:/gm)) targets.add(m[1]!);
  return targets;
}

/** Commands in fenced sh/bash blocks of `file` that name a missing script, Make target or file. */
export function brokenCommands(root: string, file: string): string[] {
  const text = readFileSync(file, "utf8");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};
  const targets = makeTargets(root);
  const problems: string[] = [];
  const name = relative(root, file);
  for (const block of text.matchAll(/```(?:sh|bash)\n([\s\S]*?)```/g)) {
    for (const raw of block[1]!.split("\n")) {
      const line = raw.replace(/^\s*\$\s*/, "").trim();
      if (line === "" || line.startsWith("#")) continue;
      const words = line.split(/\s+/).filter((w) => !/^[A-Z_][A-Z0-9_]*=/.test(w));
      const [cmd, a, b] = words;
      if (cmd === "npm" && (a === "run" || a === "run-script") && b && !(b in scripts)) {
        problems.push(`${name}: npm script not in package.json: ${b}`);
      } else if (cmd === "npm" && (a === "test" || a === "start") && !(a in scripts)) {
        problems.push(`${name}: npm script not in package.json: ${a}`);
      } else if (cmd === "make" && a && !a.startsWith("-") && !targets.has(a)) {
        problems.push(`${name}: Make target not in Makefile: ${a}`);
      } else if ((cmd === "node" || cmd === "bash" || cmd === "sh") && a && !a.startsWith("-")) {
        if (!pathExists(root, a)) problems.push(`${name}: file not found: ${a}`);
      } else if (cmd && /^\.\.?\//.test(cmd) && !pathExists(root, cmd)) {
        problems.push(`${name}: file not found: ${cmd}`);
      }
    }
  }
  return problems;
}

// Built output (dist/x.js) exists only after `npm run build`; accept it when the source exists.
function pathExists(root: string, p: string): boolean {
  if (existsSync(join(root, p))) return true;
  const m = /^dist\/(.+)\.js$/.exec(p);
  return m !== null && existsSync(join(root, `${m[1]}.ts`));
}

export function checkDocs(root: string): string[] {
  const problems: string[] = [];
  for (const f of markdownFiles(root)) problems.push(...brokenLinks(root, f));
  const readme = join(root, "README.md");
  if (existsSync(readme)) problems.push(...brokenCommands(root, readme));
  return problems;
}
