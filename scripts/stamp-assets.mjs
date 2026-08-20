import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageMetadata = JSON.parse(
  readFileSync(path.join(projectRoot, "package.json"), "utf8"),
);
const indexPath = path.join(projectRoot, "wordsim", "index.html");
const current = readFileSync(indexPath, "utf8");
const stamped = current
  .replace(/href="\.\/app\.css(?:\?v=[^"]+)?"/, `href="./app.css?v=${packageMetadata.version}"`)
  .replace(/src="\.\/app\.js(?:\?v=[^"]+)?"/, `src="./app.js?v=${packageMetadata.version}"`);

if (stamped === current) {
  const expectedVersion = `?v=${packageMetadata.version}`;
  if (!current.includes(`app.css${expectedVersion}`) || !current.includes(`app.js${expectedVersion}`)) {
    throw new Error("Could not find the application asset references to stamp.");
  }
} else {
  writeFileSync(indexPath, stamped);
}
