export async function onRequestGet() {
  const ghHeaders = {
    "User-Agent": "BalochPing-Site",
    "Accept": "application/vnd.github+json"
  };

  let releases = [];
  let vip = null;

  try {
    const [relRes, vipRes] = await Promise.all([
      fetch("https://api.github.com/repos/balochping/BalochPing-Releases/releases?per_page=10", {
        headers: ghHeaders,
        cf: { cacheTtl: 300, cacheEverything: true }
      }),
      fetch("https://raw.githubusercontent.com/balochping/BalochPing-Releases/refs/heads/main/vip.json", {
        headers: { "User-Agent": "BalochPing-Site" },
        cf: { cacheTtl: 180, cacheEverything: true }
      })
    ]);

    if (relRes.ok) {
      const data = await relRes.json();
      if (Array.isArray(data)) {
        releases = data
          .filter((r) => !r.draft)
          .map((r) => ({
            tag: r.tag_name || "",
            name: r.name || r.tag_name || "",
            body: r.body || "",
            published_at: r.published_at || "",
            assets: (r.assets || [])
              .filter((a) => a.name && a.name.toLowerCase().endsWith(".apk"))
              .map((a) => ({
                name: a.name,
                size: a.size || 0,
                url: a.browser_download_url || ""
              }))
          }));
      }
    }

    if (vipRes.ok) {
      vip = await vipRes.json();
    }
  } catch (_) {}

  return new Response(JSON.stringify({ releases, vip }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=180"
    }
  });
}
