import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";

const rendererUrl = pathToFileURL(
  path.join(process.cwd(), "scripts/build-changelog.mjs"),
).href;

function render(markdown: string): string {
  const program = [
    `import { renderMarkdown } from ${JSON.stringify(rendererUrl)};`,
    `process.stdout.write(renderMarkdown(${JSON.stringify(markdown)}));`,
  ].join("\n");
  return execFileSync(process.execPath, ["--input-type=module", "--eval", program], {
    encoding: "utf8",
  });
}

describe("public changelog renderer", () => {
  it("omits unreleased notes and safely renders the supported Markdown subset", () => {
    const html = render([
      "# Changelog",
      "",
      "## [Unreleased]",
      "",
      "- private draft",
      "",
      "## [1.2.1] - 2026-08-18",
      "",
      "### Added",
      "",
      "- <script>alert(1)</script> with `code` and [notes](https://example.com/notes)",
      "- [unsafe](javascript:alert(1))",
    ].join("\n"));

    assert.doesNotMatch(html, /private draft/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /<code>code<\/code>/);
    assert.match(html, /href="https:\/\/example\.com\/notes"/);
    assert.doesNotMatch(html, /javascript:/);
  });
});
