import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const clientDir = "dist/client";
const indexPath = join(clientDir, "index.html");
const fallbackCandidates = [
  indexPath,
  join(clientDir, "_shell.html"),
  join(clientDir, ".html"),
];

function firstHtmlFile(dir) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isFile() && entry.endsWith(".html")) return path;
  }
  return null;
}

const source = fallbackCandidates.find(existsSync) ?? firstHtmlFile(clientDir);

if (!source) {
  throw new Error("Build Vercel invalide : aucun fichier HTML trouvé dans dist/client.");
}

if (source !== indexPath) {
  mkdirSync(dirname(indexPath), { recursive: true });
  copyFileSync(source, indexPath);
}

console.log(`[vercel] SPA fallback prêt: ${indexPath}`);