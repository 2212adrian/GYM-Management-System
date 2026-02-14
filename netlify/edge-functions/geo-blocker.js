function isLocalDev(url) {
  try {
    const host = String(url.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function wantsHtml(request) {
  const mode = String(request.headers.get("sec-fetch-mode") || "").toLowerCase();
  if (mode === "navigate") return true;

  const accept = String(request.headers.get("accept") || "").toLowerCase();
  return accept.includes("text/html");
}

function isSensitivePath(pathname) {
  const p = String(pathname || "/");

  // Block common admin probes and sensitive artifacts explicitly.
  const blockedPrefixes = [
    "/.git",
    "/wp-admin",
    "/phpmyadmin",
    "/administrator",
    "/admin",
  ];
  for (const prefix of blockedPrefixes) {
    if (p === prefix || p.startsWith(prefix + "/")) return true;
  }

  const blockedFiles = new Set([
    "/backup.zip",
    "/backup.sql",
    "/database.sql",
    "/db.sql",
    "/backup.tar.gz",
    "/site-backup.zip",
    "/backup.bak",
  ]);
  if (blockedFiles.has(p)) return true;

  return false;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname || "/";

  // Hard deny sensitive paths (return a true 404 without revealing anything).
  if (isSensitivePath(path)) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  }

  // Always allow the block page itself so it can render.
  if (path === "/philippines-only" || path.startsWith("/philippines-only/")) {
    return context.next();
  }

  // Netlify sets x-nf-geo-country in production. Accept a couple header variants.
  const countryCodeRaw =
    request.headers.get("x-nf-geo-country") ||
    request.headers.get("x-nf-country") ||
    "";
  const countryCode = String(countryCodeRaw).trim().toUpperCase();

  // If Netlify geo headers are missing, don't block. Otherwise you'd block PH users
  // when the platform doesn't send geo info (or during some environments).
  if (!countryCode) return context.next();

  // Avoid blocking local dev if someone manually sets a non-PH header.
  if (isLocalDev(url)) return context.next();

  if (countryCode !== "PH") {
    if (wantsHtml(request)) {
      const blockUrl = new URL("/philippines-only/", url);
      if (countryCode) blockUrl.searchParams.set("cc", countryCode);
      return Response.redirect(blockUrl, 302);
    }

    return new Response(
      JSON.stringify({
        errorKey: "COUNTRY_BLOCKED",
        error: "Access from this country is not permitted.",
        country: countryCode || null,
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      }
    );
  }

  return context.next();
};
