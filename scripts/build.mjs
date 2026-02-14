import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

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

async function injectPublicSupabaseConfig() {
  const cfgPath = path.join(outDir, "assets", "js", "utils", "supabase-public-config.js");
  const hasCfg = await fileExists(cfgPath);
  if (!hasCfg) return false;

  const supabaseUrl = (
    process.env.PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).trim();
  const supabaseAnonKey = (
    process.env.PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    ""
  ).trim();

  if (!supabaseUrl || !supabaseAnonKey) return false;

  let source = await fs.readFile(cfgPath, "utf8");
  source = source
    .replaceAll("__WOLF_SUPABASE_URL__", supabaseUrl)
    .replaceAll("__WOLF_SUPABASE_ANON_KEY__", supabaseAnonKey);
  await fs.writeFile(cfgPath, source, "utf8");
  return true;
}

async function injectPublicRecaptchaConfig() {
  const cfgPath = path.join(outDir, "assets", "js", "utils", "recaptcha-public-config.js");
  const hasCfg = await fileExists(cfgPath);
  if (!hasCfg) return false;

  const siteKey = (
    process.env.PUBLIC_RECAPTCHA_SITE_KEY ||
    process.env.RECAPTCHA_SITE_KEY ||
    ""
  ).trim();

  if (!siteKey) return false;

  let source = await fs.readFile(cfgPath, "utf8");
  source = source.replaceAll("__WOLF_RECAPTCHA_SITE_KEY__", siteKey);
  await fs.writeFile(cfgPath, source, "utf8");
  return true;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

async function fileExists(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function resolveAssetPath(refPath, htmlFilePath) {
  const cleanRef = refPath.split(/[?#]/, 1)[0];
  if (!cleanRef) return null;

  const candidates = [];
  if (cleanRef.startsWith("/")) {
    candidates.push(path.join(outDir, cleanRef.slice(1)));
  } else {
    candidates.push(path.resolve(path.dirname(htmlFilePath), cleanRef));
    if (cleanRef.startsWith("assets/")) {
      candidates.push(path.join(outDir, cleanRef));
    } else if (cleanRef.startsWith("./assets/")) {
      candidates.push(path.join(outDir, cleanRef.slice(2)));
    }
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

function withHashedFilename(refPath, hashedFilename) {
  const [basePath, suffix = ""] = refPath.split(/([?#].*)/, 2);
  const slashIndex = basePath.lastIndexOf("/");
  if (slashIndex === -1) return `${hashedFilename}${suffix}`;
  return `${basePath.slice(0, slashIndex + 1)}${hashedFilename}${suffix}`;
}

async function hashAssetFilenames() {
  const allFiles = await walk(outDir);
  const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));
  const htmlByPath = new Map();
  const refsByHtml = new Map();
  const assetsToHash = new Set();
  const hashedByAbsolutePath = new Map();
  const refPattern = /\b(?:src|href)=["']([^"']+)["']/gi;

  for (const htmlFile of htmlFiles) {
    const html = await fs.readFile(htmlFile, "utf8");
    htmlByPath.set(htmlFile, html);
    const refs = [];
    const matches = [...html.matchAll(refPattern)];
    for (const match of matches) {
      const fullRef = match[1];
      if (
        /^https?:\/\//i.test(fullRef) ||
        fullRef.startsWith("//") ||
        fullRef.startsWith("data:") ||
        fullRef.startsWith("#")
      ) {
        continue;
      }

      const resolvedPath = await resolveAssetPath(fullRef, htmlFile);
      if (!resolvedPath) continue;

      const relativeToOut = toPosix(path.relative(outDir, resolvedPath));
      if (!relativeToOut.startsWith("assets/")) continue;

      const ext = path.extname(resolvedPath).toLowerCase();
      if (ext !== ".js" && ext !== ".css") continue;
      refs.push({ fullRef, resolvedPath });
      assetsToHash.add(resolvedPath);
    }
    refsByHtml.set(htmlFile, refs);
  }

  for (const resolvedPath of assetsToHash) {
    const fileBuffer = await fs.readFile(resolvedPath);
    const hash = createHash("sha256").update(fileBuffer).digest("hex");
    const parsed = path.parse(resolvedPath);
    const hashedFilename = `${hash}${parsed.ext}`;
    const hashedPath = path.join(parsed.dir, hashedFilename);
    if (await fileExists(hashedPath)) {
      await fs.rm(resolvedPath, { force: true });
    } else {
      await fs.rename(resolvedPath, hashedPath);
    }
    hashedByAbsolutePath.set(resolvedPath, hashedFilename);
  }

  for (const [htmlFile, html] of htmlByPath.entries()) {
    const refs = refsByHtml.get(htmlFile) || [];
    const refToHashedName = new Map();
    for (const ref of refs) {
      const hashedName = hashedByAbsolutePath.get(ref.resolvedPath);
      if (hashedName) refToHashedName.set(ref.fullRef, hashedName);
    }

    if (!refToHashedName.size) continue;

    const rewritten = html.replace(
      /\b((?:src|href)=["'])([^"']+)(["'])/gi,
      (fullMatch, prefix, currentRef, suffix) => {
        const hashedName = refToHashedName.get(currentRef);
        if (!hashedName) return fullMatch;
        return `${prefix}${withHashedFilename(currentRef, hashedName)}${suffix}`;
      }
    );
    await fs.writeFile(htmlFile, rewritten, "utf8");
  }

  const manifestEntries = [];
  for (const [originalPath, hashedName] of hashedByAbsolutePath.entries()) {
    const originalRel = toPosix(path.relative(outDir, originalPath));
    const hashedRel = toPosix(path.join(path.dirname(originalRel), hashedName));
    manifestEntries.push([`/${originalRel}`, `/${hashedRel}`]);
  }
  manifestEntries.sort((a, b) => a[0].localeCompare(b[0]));
  const manifest = Object.fromEntries(manifestEntries);
  await fs.writeFile(
    path.join(outDir, "asset-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  return hashedByAbsolutePath.size;
}

async function main() {
  await copyPublic();
  const injectedPublicConfig = await injectPublicSupabaseConfig();
  const injectedRecaptchaConfig = await injectPublicRecaptchaConfig();
  const minifiedCount = await minifyJs();
  const hashedCount = await hashAssetFilenames();
  console.log(`[build] Copied public -> dist/public`);
  console.log(`[build] Injected Supabase public config: ${injectedPublicConfig ? "yes" : "no"}`);
  console.log(`[build] Injected reCAPTCHA public config: ${injectedRecaptchaConfig ? "yes" : "no"}`);
  console.log(`[build] Minified ${minifiedCount} JS files`);
  console.log(`[build] Hashed ${hashedCount} asset filenames`);
}

main().catch((err) => {
  console.error("[build] Failed:", err);
  process.exit(1);
});
