export async function onRequestGet(context) {
  const cache = caches.default;
  // کلید کش یکسان برای هر دو دامنه تا درخواست تکراری به گیت‌هاب نره
  const freshKey = new Request("https://balochping.ir/__cache/api-fresh-v1");
  const backupKey = new Request("https://balochping.ir/__cache/api-backup-v1");

  // ۱. اول از کش ۵ دقیقه‌ای کلودفلر بخون (صفر درخواست به گیت‌هاب)
  try {
    const cached = await cache.match(freshKey);
    if (cached) return cached;
  } catch (_) {}

  const ghHeaders = {
    "User-Agent": "BalochPing-Site",
    "Accept": "application/vnd.github+json"
  };

  // اگر روزی خواستی توی تنظیمات کلودفلر GITHUB_TOKEN بذاری، خودکار استفاده می‌کنه (۵۰۰۰ درخواست در ساعت)
  if (context.env && context.env.GITHUB_TOKEN) {
    ghHeaders["Authorization"] = `Bearer ${context.env.GITHUB_TOKEN}`;
  }

  let releases = [];
  let vip = null;

  try {
    const [relRes, vipRes] = await Promise.all([
      fetch("https://api.github.com/repos/balochping/BalochPing-Releases/releases?per_page=10", {
        headers: ghHeaders,
        cf: {
          cacheEverything: true,
          cacheTtlByStatus: { "200-299": 300, "400-599": 0 }
        }
      }),
      fetch("https://raw.githubusercontent.com/balochping/BalochPing-Releases/refs/heads/main/vip.json", {
        headers: { "User-Agent": "BalochPing-Site" },
        cf: {
          cacheEverything: true,
          cacheTtlByStatus: { "200-299": 180, "400-599": 0 }
        }
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

  // ۲. اگر گیت‌هاب جواب سالم داد، هم ۵ دقیقه کش کن هم ۲۴ ساعت بکاپ بگیر
  if (releases.length > 0) {
    const body = JSON.stringify({ releases, vip });

    const freshRes = new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, max-age=180"
      }
    });

    const backupRes = new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=86400, max-age=60"
      }
    });

    try {
      context.waitUntil(
        Promise.all([
          cache.put(freshKey, freshRes.clone()),
          cache.put(backupKey, backupRes)
        ])
      );
    } catch (_) {}

    return freshRes;
  }

  // ۳. اگر گیت‌هاب محدودیت زد یا قطع بود، آخرین نسخه سالم ۲۴ ساعت گذشته رو برگردون
  try {
    const stale = await cache.match(backupKey);
    if (stale) return stale;
  } catch (_) {}

  // ۴. هیچ‌وقت پاسخ خالی/خطا رو کش نکن تا رفرش بعدی دوباره تلاش کنه
  return new Response(JSON.stringify({ releases, vip }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
