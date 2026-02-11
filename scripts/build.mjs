import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "public");
const outDir = path.join(rootDir, "dist", "public");

async function copyPublic() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(outDir), { recursive: true });
  await fs.cp(srcDir, outDir, { recursive: true });
}

async function walk(dir, fileList = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function minifyJs() {
  const { transform } = await import("esbuild");
  const allFiles = await walk(outDir);
  const jsFiles = allFiles.filter((f) => f.endsWith(".js"));

  for (const file of jsFiles) {
    const code = await fs.readFile(file, "utf8");
    const result = await transform(code, {
      loader: "js",
      minify: true,
      legalComments: "none",
      target: "es2018",
      charset: "utf8",
    });
    await fs.writeFile(file, result.code, "utf8");
  }

  return jsFiles.length;
}

async function main() {
  await copyPublic();
  const total = await minifyJs();
  console.log(`[build] Copied public -> dist/public`);
  console.log(`[build] Minified ${total} JS files`);
}

main().catch((err) => {
  console.error("[build] Failed:", err);
  process.exit(1);
});
