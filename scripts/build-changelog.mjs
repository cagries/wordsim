import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(projectRoot, "CHANGELOG.md");
const outputPath = path.join(projectRoot, "wordsim", "changelog.html");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeHref(value) {
  if (/^(?:https?:\/\/|\.\.?\/|#)/.test(value)) return escapeHtml(value);
  return null;
}

function renderInline(value) {
  const tokens = value.split(/(`[^`]*`|\[[^\]]+\]\([^)]+\))/g);
  return tokens.map((token) => {
    const code = token.match(/^`([^`]*)`$/);
    if (code) return `<code>${escapeHtml(code[1])}</code>`;
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      return href ? `<a href="${href}">${escapeHtml(link[1])}</a>` : escapeHtml(link[1]);
    }
    return escapeHtml(token);
  }).join("");
}

export function renderMarkdown(markdown) {
  const output = [];
  let paragraph = [];
  let listOpen = false;
  let releaseOpen = false;
  let skippingUnreleased = false;

  const closeList = () => {
    if (listOpen) output.push("</ul>");
    listOpen = false;
  };
  const flushParagraph = () => {
    if (paragraph.length > 0) output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushBlocks = () => {
    flushParagraph();
    closeList();
  };

  for (const line of markdown.split(/\r?\n/)) {
    if (/^# /.test(line)) continue;
    if (/^## \[Unreleased\]/.test(line)) {
      flushBlocks();
      skippingUnreleased = true;
      continue;
    }
    const release = line.match(/^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$/);
    if (release) {
      flushBlocks();
      if (releaseOpen) output.push("</section>");
      skippingUnreleased = false;
      releaseOpen = true;
      output.push(`<section class="release"><h2><span>v${escapeHtml(release[1])}</span><time datetime="${release[2]}">${release[2]}</time></h2>`);
      continue;
    }
    if (skippingUnreleased) continue;
    const heading = line.match(/^### (.+)$/);
    if (heading) {
      flushBlocks();
      output.push(`<h3>${renderInline(heading[1])}</h3>`);
      continue;
    }
    const item = line.match(/^- (.+)$/);
    if (item) {
      flushParagraph();
      if (!listOpen) {
        output.push("<ul>");
        listOpen = true;
      }
      output.push(`<li>${renderInline(item[1])}</li>`);
      continue;
    }
    if (line.trim() === "") {
      flushBlocks();
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  flushBlocks();
  if (releaseOpen) output.push("</section>");
  return output.join("\n");
}

function buildPage() {
  const content = renderMarkdown(readFileSync(sourcePath, "utf8"));
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Release history for wordsim.">
    <title>Changelog · wordsim</title>
    <link rel="stylesheet" href="./app.css">
  </head>
  <body>
    <main class="landing changelog-page">
      <header class="changelog-header">
        <h1><a class="home-link" href="./">wordsim</a></h1>
        <p><a href="./">← Back to game</a></p>
      </header>
      <h2>Changelog</h2>
      <div class="changelog-content">
${content.split("\n").map((line) => `        ${line}`).join("\n")}
      </div>
    </main>
  </body>
</html>
`;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const page = buildPage();
  let current = null;
  try {
    current = readFileSync(outputPath, "utf8");
  } catch {
    // The first build creates the generated page.
  }
  if (current !== page) writeFileSync(outputPath, page);
}
