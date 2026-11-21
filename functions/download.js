export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const target = reqUrl.searchParams.get("url") || "";

  const allowedPrefix = "https://github.com/balochping/BalochPing-Releases/releases/download/";
  if (!target.startsWith(allowedPrefix) || !target.toLowerCase().endsWith(".apk")) {
    return new Response("Invalid download link", { status: 400 });
  }

  const upstream = await fetch(target, {
    headers: { "User-Agent": "BalochPing-Site" },
    redirect: "follow"
  });

  if (!upstream.ok) {
    return new Response("File not found", { status: upstream.status });
  }

  const rawName = decodeURIComponent(target.split("/").pop() || "BalochPing.apk");
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");

  const outHeaders = new Headers();
  outHeaders.set("Content-Type", "application/vnd.android.package-archive");
  outHeaders.set("Content-Disposition", `attachment; filename="${safeName}"`);
  const length = upstream.headers.get("Content-Length");
  if (length) outHeaders.set("Content-Length", length);
  outHeaders.set("Cache-Control", "public, max-age=3600");

  return new Response(upstream.body, {
    status: 200,
    headers: outHeaders
  });
}
