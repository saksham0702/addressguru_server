import dns from "dns";
import axios from "axios";
import * as cheerio from "cheerio";

// ─── SSRF PROTECTION HELPERS ────────────────────────────────────────────────
const PRIVATE_IP_PATTERNS = [
  /^127\./, // 127.0.0.0/8 loopback
  /^10\./, // 10.0.0.0/8 private
  /^192\.168\./, // 192.168.0.0/16 private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 private
  /^169\.254\./, // 169.254.0.0/16 link-local / AWS metadata
  /^0\./, // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // 100.64.0.0/10 Carrier-grade NAT
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link local
  /^fd/i,
];

export async function validatePublicUrl(rawUrl) {
  let parsed;
  try {
    const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawUrl);
    parsed = new URL(hasProtocol ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new Error("Invalid URL format. Please enter a valid website address.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Disallow localhost and special local domains
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  ) {
    throw new Error("Access to local and loopback addresses is prohibited.");
  }

  // Resolve DNS to verify IP addresses are not private/internal (SSRF defense)
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }

    for (const record of addresses) {
      const ip = record.address;
      for (const pattern of PRIVATE_IP_PATTERNS) {
        if (pattern.test(ip)) {
          throw new Error("Access to private or internal network addresses is prohibited.");
        }
      }
    }
  } catch (err) {
    if (err.message.includes("prohibited")) throw err;
    throw new Error(`Domain resolution failed for "${hostname}": ${err.message}`);
  }

  return parsed.toString();
}

// ─── HTTP REQUEST HELPER ────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AddressGuru-WebsiteAuditBot/1.0 (+https://addressguru.ae/website-audit)";

const httpClient = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  maxRedirects: 5,
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
  validateStatus: () => true, // Don't throw on 4xx/5xx so we can evaluate status codes
});

// Delay utility for polite crawling
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Cache for client script chunks to avoid redundant network downloads across pages
const chunkScriptCache = new Map();

// ─── ROBOTS.TXT CHECKER ─────────────────────────────────────────────────────
export async function checkRobotsTxt(origin) {
  try {
    const robotsUrl = `${origin}/robots.txt`;
    const res = await httpClient.get(robotsUrl);
    if (res.status === 200 && typeof res.data === "string" && res.data.length > 0) {
      const lines = res.data.split("\n");
      const disallowedPaths = [];
      let appliesToAll = false;
      let sitemapUrl = null;

      for (const line of lines) {
        const clean = line.trim();
        if (clean.toLowerCase().startsWith("user-agent:")) {
          const agent = clean.slice(11).trim();
          appliesToAll = agent === "*";
        } else if (appliesToAll && clean.toLowerCase().startsWith("disallow:")) {
          const path = clean.slice(9).trim();
          if (path) disallowedPaths.push(path);
        } else if (clean.toLowerCase().startsWith("sitemap:")) {
          sitemapUrl = clean.slice(8).trim();
        }
      }

      return {
        exists: true,
        statusCode: res.status,
        disallowedPaths,
        sitemapUrl,
      };
    }
    return { exists: false, statusCode: res.status, disallowedPaths: [], sitemapUrl: null };
  } catch {
    return { exists: false, statusCode: 0, disallowedPaths: [], sitemapUrl: null };
  }
}

// ─── SITEMAP.XML CHECKER ────────────────────────────────────────────────────
export async function checkSitemapXml(origin, robotsSitemap) {
  const targetUrl = robotsSitemap || `${origin}/sitemap.xml`;
  try {
    const res = await httpClient.get(targetUrl, { timeout: 5000 });
    const isXml =
      res.status === 200 &&
      (typeof res.data === "string" &&
        (res.data.includes("<urlset") ||
          res.data.includes("<sitemapindex") ||
          res.headers["content-type"]?.includes("xml")));
    return {
      exists: isXml,
      statusCode: res.status,
      url: targetUrl,
    };
  } catch {
    return { exists: false, statusCode: 0, url: targetUrl };
  }
}

// ─── CRAWL & ANALYZE PAGE ───────────────────────────────────────────────────
export async function fetchAndAnalyzePage(pageUrl, origin) {
  const startTime = Date.now();
  let res;
  let lastError = null;

  // Try request with 1 automatic retry on timeout or connection blips
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      res = await httpClient.get(pageUrl);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await sleep(500);
      }
    }
  }

  if (lastError || !res) {
    return {
      error: lastError?.message || "Connection timed out or failed to connect",
      statusCode: 0,
      url: pageUrl,
      responseTimeMs: Date.now() - startTime,
      pageSizeKb: 0,
    };
  }

  const responseTimeMs = Date.now() - startTime;
  const statusCode = res.status;
  const html = typeof res.data === "string" ? res.data : "";
  const pageSizeKb = Math.round((Buffer.byteLength(html, "utf8") / 1024) * 10) / 10;
  const contentEncoding = res.headers["content-encoding"] || "none";

  if (statusCode >= 400 || !html || pageSizeKb === 0) {
    return {
      url: pageUrl,
      statusCode,
      responseTimeMs,
      pageSizeKb,
      contentEncoding,
      error: `Server returned status ${statusCode}`,
    };
  }

  const $ = cheerio.load(html);

  // SEO Elements - robust multi-pass extraction
  let title = $("title").first().text().trim();
  if (!title) {
    // Check raw regex if Cheerio parsing missed a title in edge-case HTML
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = cheerio.load(titleMatch[0])("title").text().trim();
    }
  }
  if (!title) {
    // Fallback to og:title or twitter:title
    title =
      $('meta[property="og:title" i]').attr("content")?.trim() ||
      $('meta[name="twitter:title" i]').attr("content")?.trim() ||
      "";
  }

  let metaDescription =
    $('meta[name="description" i]').attr("content")?.trim() ||
    $('meta[property="og:description" i]').attr("content")?.trim() ||
    $('meta[name="twitter:description" i]').attr("content")?.trim() ||
    "";
  if (!metaDescription) {
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    if (descMatch && descMatch[1]) {
      metaDescription = descMatch[1].trim();
    }
  }

  const canonical = $('link[rel="canonical" i]').attr("href")?.trim() || "";
  const lang = $("html").attr("lang")?.trim() || "";
  const robotsMeta = $('meta[name="robots" i]').attr("content")?.trim() || "";
  const viewport = $('meta[name="viewport" i]').attr("content")?.trim() || "";

  // Headings - robust extraction
  const h1Elements = $("h1");
  let h1Count = h1Elements.length;
  let h1Text = h1Elements.first().text().trim();
  if (h1Count === 0) {
    const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
    if (h1Matches && h1Matches.length > 0) {
      h1Count = h1Matches.length;
      h1Text = cheerio.load(h1Matches[0])("h1").text().trim();
    }
  }

  // Fallback 1: ARIA role="heading" with aria-level="1"
  if (h1Count === 0) {
    const ariaH1 = $('[role="heading"][aria-level="1"]');
    if (ariaH1.length > 0) {
      h1Count = ariaH1.length;
      h1Text = ariaH1.first().text().trim();
    }
  }

  // Fallback 2: Next.js / React client-rendered components (chunks) or streaming payloads
  if (h1Count === 0) {
    // 2a. Check inline RSC streaming scripts or __NEXT_DATA__
    const rscScripts = $("script").filter((_, el) => {
      const c = $(el).html() || "";
      return c.includes("self.__next_f") || c.includes("__NEXT_DATA__");
    });
    rscScripts.each((_, el) => {
      if (h1Count > 0) return;
      const content = $(el).html() || "";
      const rscMatch = content.match(/\["\$","h1",[^,]*,\{"(?:[^"}]*",)*"children":(?:\(?\[)?["']([^"']+)["']/);
      if (rscMatch && rscMatch[1]) {
        h1Count = 1;
        h1Text = rscMatch[1].trim();
      }
    });

    // 2b. Check page client chunk scripts for Next.js / React compiled JSX
    if (h1Count === 0) {
      const chunkUrls = [];
      $("script[src]").each((_, el) => {
        const src = $(el).attr("src") || "";
        if (src.includes("/chunks/") || src.includes("/static/js/") || src.includes("/assets/")) {
          try {
            chunkUrls.push(src.startsWith("http") ? src : new URL(src, pageUrl).toString());
          } catch {}
        }
      });

      if (chunkUrls.length > 0) {
        try {
          const chunkFetches = chunkUrls.slice(0, 25).map(async (url) => {
            try {
              if (chunkScriptCache.has(url)) {
                return chunkScriptCache.get(url);
              }
              const cRes = await httpClient.get(url, { timeout: 3500 });
              const data = typeof cRes.data === "string" ? cRes.data : "";
              if (chunkScriptCache.size < 200) {
                chunkScriptCache.set(url, data);
              }
              return data;
            } catch {
              return "";
            }
          });
          const chunkCodes = await Promise.all(chunkFetches);
          const h1Regex = /jsx[s]?\)?\s*\(\s*["']h1["']\s*,\s*\{[\s\S]*?children:\s*(?:\[\s*)?["']([^"']+)["']/g;
          for (const code of chunkCodes) {
            if (!code.includes('"h1"') && !code.includes("'h1'")) continue;
            let m;
            while ((m = h1Regex.exec(code)) !== null) {
              const candidate = m[1]?.trim();
              if (
                candidate &&
                !candidate.toLowerCase().includes("error") &&
                !candidate.toLowerCase().includes("offline") &&
                !candidate.toLowerCase().includes("not found")
              ) {
                h1Count = 1;
                h1Text = candidate;
                break;
              }
            }
            if (h1Count > 0) break;
          }
        } catch {}
      }
    }
  }

  const h2Count = $("h2").length;
  const h3Count = $("h3").length;
  const h4Count = $("h4").length;

  // Check heading hierarchy (e.g., has H3 without H2, has H4 without H3, has H2 without H1)
  let hasSequentialStructure = true;
  if (h3Count > 0 && h2Count === 0) hasSequentialStructure = false;
  if (h4Count > 0 && h3Count === 0) hasSequentialStructure = false;
  if ((h2Count > 0 || h3Count > 0) && h1Count === 0) hasSequentialStructure = false;

  // Word count - remove scripts, styles, noscript, svg to calculate real text word count
  $("script, style, noscript, svg").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

  // Canonical check
  let isCanonicalSelfReferencing = true;
  if (canonical) {
    try {
      const parsedCanonical = new URL(canonical, origin).toString().replace(/\/$/, "");
      const parsedCurrent = new URL(pageUrl).toString().replace(/\/$/, "");
      isCanonicalSelfReferencing = parsedCanonical === parsedCurrent;
    } catch {
      isCanonicalSelfReferencing = false;
    }
  }

  // Structured Data (JSON-LD or Microdata)
  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  const hasMicrodata = $("[itemscope]").length > 0;
  const hasStructuredData = hasJsonLd || hasMicrodata;

  // Extract Images
  const images = [];
  $("img").each((_, el) => {
    const rawSrc = $(el).attr("src") || $(el).attr("data-src") || "";
    if (!rawSrc || rawSrc.startsWith("data:")) return;

    let absoluteUrl = "";
    try {
      absoluteUrl = new URL(rawSrc, pageUrl).toString();
    } catch {
      return;
    }

    const alt = $(el).attr("alt");
    const hasAlt = typeof alt === "string" && alt.trim().length > 0;
    const width = $(el).attr("width") || "";
    const height = $(el).attr("height") || "";
    const hasDimensions = Boolean(width && height);

    images.push({
      url: absoluteUrl,
      pageUrl,
      alt: typeof alt === "string" ? alt.trim() : "",
      hasAlt,
      hasDimensions,
      width,
      height,
    });
  });

  // Extract Links
  const internalLinks = [];
  const externalLinks = [];
  $("a").each((_, el) => {
    const rawHref = $(el).attr("href");
    if (!rawHref) return;

    const trimmed = rawHref.trim();
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("javascript:") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("tel:")
    ) {
      return;
    }

    let absoluteUrl = "";
    try {
      absoluteUrl = new URL(trimmed, pageUrl).toString();
    } catch {
      return;
    }

    const anchorText = $(el).text().trim();
    const hasImgAlt = $(el).find("img[alt]").length > 0;
    const ariaLabel = $(el).attr("aria-label");
    const hasAnchorText = Boolean(anchorText || hasImgAlt || ariaLabel);

    let isExternal = false;
    try {
      const linkOrigin = new URL(absoluteUrl).origin;
      isExternal = linkOrigin !== origin;
    } catch {
      isExternal = true;
    }

    const linkItem = {
      sourceUrl: pageUrl,
      targetUrl: absoluteUrl,
      text: anchorText || ariaLabel || (hasImgAlt ? "[Image]" : ""),
      hasAnchorText,
      isExternal,
    };

    if (isExternal) {
      externalLinks.push(linkItem);
    } else {
      internalLinks.push(linkItem);
    }
  });

  return {
    url: pageUrl,
    statusCode,
    responseTimeMs,
    pageSizeKb,
    contentEncoding,
    title,
    titleLength: title.length,
    metaDescription,
    metaDescriptionLength: metaDescription.length,
    canonical,
    isCanonicalSelfReferencing,
    lang,
    robotsMeta,
    viewport,
    h1: h1Text,
    h1Count,
    headings: {
      h2Count,
      h3Count,
      h4Count,
      hasSequentialStructure,
    },
    wordCount,
    hasStructuredData,
    images,
    internalLinks,
    externalLinks,
  };
}

// ─── SAMPLE CHECK FOR IMAGES & LINKS ────────────────────────────────────────
async function checkImageStatus(imgUrl) {
  try {
    const res = await httpClient.head(imgUrl, { timeout: 8000 });
    if (res.status === 405 || res.status === 403) {
      const getRes = await httpClient.get(imgUrl, {
        timeout: 8000,
        headers: { Range: "bytes=0-1024" },
      });
      const sizeBytes = parseInt(getRes.headers["content-length"] || "0", 10);
      return {
        statusCode: getRes.status,
        sizeKb: sizeBytes > 0 ? Math.round((sizeBytes / 1024) * 10) / 10 : 0,
      };
    }
    const sizeBytes = parseInt(res.headers["content-length"] || "0", 10);
    return {
      statusCode: res.status,
      sizeKb: sizeBytes > 0 ? Math.round((sizeBytes / 1024) * 10) / 10 : 0,
    };
  } catch {
    try {
      const getRes = await httpClient.get(imgUrl, {
        timeout: 8000,
        headers: { Range: "bytes=0-1024" },
      });
      const sizeBytes = parseInt(getRes.headers["content-length"] || "0", 10);
      return {
        statusCode: getRes.status,
        sizeKb: sizeBytes > 0 ? Math.round((sizeBytes / 1024) * 10) / 10 : 0,
      };
    } catch {
      return { statusCode: 0, sizeKb: 0 };
    }
  }
}

async function checkLinkStatus(linkUrl, knownPagesMap) {
  const clean = linkUrl.split("#")[0].replace(/\/$/, "");
  if (knownPagesMap && knownPagesMap.has(clean)) {
    const code = knownPagesMap.get(clean);
    return {
      statusCode: code,
      isBroken: code >= 400 || code === 0,
      isRedirect: code >= 300 && code < 400,
    };
  }

  try {
    const res = await httpClient.head(linkUrl, { timeout: 10000 });
    if (res.status === 405 || res.status === 403 || res.status === 0) {
      const getRes = await httpClient.get(linkUrl, {
        timeout: 10000,
        headers: { Range: "bytes=0-1024" },
      });
      return {
        statusCode: getRes.status,
        isBroken: getRes.status >= 400 || getRes.status === 0,
        isRedirect: getRes.status >= 300 && getRes.status < 400,
      };
    }
    return {
      statusCode: res.status,
      isBroken: res.status >= 400 || res.status === 0,
      isRedirect: res.status >= 300 && res.status < 400,
    };
  } catch {
    try {
      const getRes = await httpClient.get(linkUrl, {
        timeout: 10000,
        headers: { Range: "bytes=0-1024" },
      });
      return {
        statusCode: getRes.status,
        isBroken: getRes.status >= 400 || getRes.status === 0,
        isRedirect: getRes.status >= 300 && getRes.status < 400,
      };
    } catch {
      return { statusCode: 0, isBroken: true, isRedirect: false };
    }
  }
}

async function runInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await sleep(60);
    }
  }
  return results;
}

// ─── MAIN AUDIT RUNNER ──────────────────────────────────────────────────────
export async function executeWebsiteAudit(targetUrl, maxPages = 5) {
  const auditStartTime = Date.now();
  const normalizedUrl = await validatePublicUrl(targetUrl);
  const parsedTarget = new URL(normalizedUrl);
  const origin = parsedTarget.origin;
  const domain = parsedTarget.hostname;

  // 1. Robots.txt & Sitemap check
  const [robotsInfo, sitemapInfo] = await Promise.all([
    checkRobotsTxt(origin),
    checkSitemapXml(origin),
  ]);

  // 2. Crawl target pages (BFS with limits)
  const queue = [normalizedUrl];
  const visited = new Set();
  const crawledPages = [];
  const allImages = [];
  const allInternalLinks = [];
  const allExternalLinks = [];

  while (queue.length > 0 && crawledPages.length < maxPages) {
    const currentUrl = queue.shift();
    const cleanUrl = currentUrl.split("#")[0].replace(/\/$/, "");

    if (visited.has(cleanUrl)) continue;
    visited.add(cleanUrl);

    // Robots.txt path check
    try {
      const urlPath = new URL(currentUrl).pathname;
      const isDisallowed = robotsInfo.disallowedPaths.some((dp) => urlPath.startsWith(dp));
      if (isDisallowed && currentUrl !== normalizedUrl) {
        continue;
      }
    } catch {
      // ignore
    }

    const pageData = await fetchAndAnalyzePage(currentUrl, origin);
    if (!pageData) continue;

    crawledPages.push(pageData);

    // Collect images
    if (pageData.images && pageData.images.length > 0) {
      allImages.push(...pageData.images);
    }

    // Collect internal & external links
    if (pageData.internalLinks) {
      allInternalLinks.push(...pageData.internalLinks);
      // Enqueue new internal links within same origin
      for (const link of pageData.internalLinks) {
        const linkClean = link.targetUrl.split("#")[0].replace(/\/$/, "");
        if (
          !visited.has(linkClean) &&
          !queue.includes(link.targetUrl) &&
          queue.length + crawledPages.length < maxPages * 3
        ) {
          try {
            const linkObj = new URL(link.targetUrl);
            // Ignore non-HTML file extensions
            if (!/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js|webp)$/i.test(linkObj.pathname)) {
              queue.push(link.targetUrl);
            }
          } catch {
            // ignore
          }
        }
      }
    }

    if (pageData.externalLinks) {
      allExternalLinks.push(...pageData.externalLinks);
    }

    // Polite delay
    await sleep(150);
  }

  if (crawledPages.length === 0) {
    throw new Error("Could not crawl target website. Please check if the website is accessible and online.");
  }

  // Known pages map from crawled pages
  const knownPagesMap = new Map();
  for (const page of crawledPages) {
    const clean = page.url.split("#")[0].replace(/\/$/, "");
    knownPagesMap.set(clean, page.statusCode || 200);
  }

  // 3. Sample check images for broken status / sizes (up to 15 unique images)
  const uniqueImageUrls = [...new Set(allImages.map((i) => i.url))].slice(0, 15);
  const imageStatusMap = new Map();
  await runInBatches(uniqueImageUrls, 4, async (imgUrl) => {
    const result = await checkImageStatus(imgUrl);
    imageStatusMap.set(imgUrl, result);
  });

  const imagesFindings = allImages.slice(0, 40).map((img) => {
    const statusInfo = imageStatusMap.get(img.url) || { statusCode: 200, sizeKb: 0 };
    return {
      url: img.url,
      pageUrl: img.pageUrl,
      alt: img.alt,
      hasAlt: img.hasAlt,
      hasDimensions: img.hasDimensions,
      width: img.width,
      height: img.height,
      statusCode: statusInfo.statusCode,
      sizeKb: statusInfo.sizeKb,
    };
  });

  // 4. Sample check internal links for broken status in polite batches
  const uniqueInternalLinks = [...new Set(allInternalLinks.map((l) => l.targetUrl))].slice(0, 25);
  const linkStatusMap = new Map();
  await runInBatches(uniqueInternalLinks, 3, async (targetUrl) => {
    const result = await checkLinkStatus(targetUrl, knownPagesMap);
    linkStatusMap.set(targetUrl, result);
  });

  const linksFindings = allInternalLinks.slice(0, 50).map((link) => {
    const status = linkStatusMap.get(link.targetUrl) || { statusCode: 200, isBroken: false, isRedirect: false };
    return {
      sourceUrl: link.sourceUrl,
      targetUrl: link.targetUrl,
      text: link.text,
      hasAnchorText: link.hasAnchorText,
      isExternal: link.isExternal,
      statusCode: status.statusCode,
      isBroken: status.isBroken,
      isRedirect: status.isRedirect,
    };
  });

  // 5. Evaluate checks, score, and issues
  const {
    categoryScores,
    overallScore,
    grade,
    issues,
    passedChecks,
    unavailableChecks,
  } = calculateScoresAndIssues({
    origin,
    domain,
    normalizedUrl,
    crawledPages,
    imagesFindings,
    linksFindings,
    robotsInfo,
    sitemapInfo,
  });

  const durationMs = Date.now() - auditStartTime;
  const totalHtmlSizeKb = crawledPages.reduce((acc, p) => acc + (p.pageSizeKb || 0), 0);

  return {
    url: normalizedUrl,
    domain,
    status: "completed",
    overallScore,
    grade,
    categoryScores,
    stats: {
      totalPagesCrawled: crawledPages.length,
      totalImages: allImages.length,
      totalInternalLinks: allInternalLinks.length,
      totalExternalLinks: allExternalLinks.length,
      durationMs,
      totalHtmlSizeKb: Math.round(totalHtmlSizeKb * 10) / 10,
    },
    crawledPages: crawledPages.map((p) => ({
      url: p.url,
      statusCode: typeof p.statusCode === "number" ? p.statusCode : 0,
      error: p.error || "",
      title: p.title || "",
      titleLength: p.titleLength || 0,
      metaDescription: p.metaDescription || "",
      metaDescriptionLength: p.metaDescriptionLength || 0,
      h1: p.h1 || "",
      h1Count: p.h1Count || 0,
      headings: p.headings || { h2Count: 0, h3Count: 0, hasSequentialStructure: true },
      canonical: p.canonical || "",
      isCanonicalSelfReferencing: p.isCanonicalSelfReferencing !== false,
      lang: p.lang || "",
      robotsMeta: p.robotsMeta || "",
      wordCount: p.wordCount || 0,
      responseTimeMs: p.responseTimeMs || 0,
      pageSizeKb: p.pageSizeKb || 0,
    })),
    imagesFindings,
    linksFindings,
    issues,
    passedChecks,
    unavailableChecks,
  };
}

// ─── DETERMINISTIC SCORING & ISSUES EVALUATION ───────────────────────────────
function calculateScoresAndIssues({
  origin,
  domain,
  normalizedUrl,
  crawledPages,
  imagesFindings,
  linksFindings,
  robotsInfo,
  sitemapInfo,
}) {
  const issues = [];
  const passedChecks = [];
  const unavailableChecks = [];

  const homePage = crawledPages[0] || {};

  // Only evaluate on-page content rules on successfully fetched HTML pages!
  const validPages = crawledPages.filter(
    (p) =>
      p.statusCode === 200 &&
      p.pageSizeKb > 0 &&
      !p.error &&
      typeof p.title === "string"
  );
  const failedPages = crawledPages.filter(
    (p) => p.statusCode === 0 || p.statusCode >= 400 || p.pageSizeKb === 0 || Boolean(p.error)
  );

  const pagesToEvaluate = validPages.length > 0 ? validPages : crawledPages;

  // ── CATEGORY 1: CONTENT & META SEO (Max: 30 pts) ─────────────────────────
  let seoScore = 0;

  // Title checks
  const pagesMissingTitle = pagesToEvaluate.filter((p) => !p.title || p.title.trim().length === 0);
  const pagesPoorTitleLength = pagesToEvaluate.filter(
    (p) => p.title && (p.title.length < 30 || p.title.length > 65)
  );

  if (pagesMissingTitle.length === 0) {
    seoScore += 3;
    if (pagesPoorTitleLength.length === 0) {
      seoScore += 3;
      passedChecks.push({
        category: "seo",
        title: "Page Titles are Optimal",
        description: "All crawled pages have descriptive page titles within the recommended length (30-65 characters).",
      });
    } else {
      seoScore += 1.5;
      const poorTitleUrls = pagesPoorTitleLength.map((p) => p.url);
      issues.push({
        id: "title-length",
        category: "seo",
        severity: "warning",
        title: "Page Title Length Can Be Improved",
        description: `Found ${pagesPoorTitleLength.length} page(s) with titles shorter than 30 or longer than 65 characters. Short titles miss keyword opportunities, while long titles may be truncated in search results.`,
        recommendation: "Keep page titles between 30 and 60 characters for optimal visibility across search engines.",
        pageUrl: poorTitleUrls[0] || normalizedUrl,
        affectedUrls: poorTitleUrls,
        evidence: `Title length (${pagesPoorTitleLength[0]?.titleLength} chars) on ${poorTitleUrls[0]}: "${pagesPoorTitleLength[0]?.title}"`,
      });
    }
  } else {
    const missingTitleUrls = pagesMissingTitle.map((p) => p.url);
    issues.push({
      id: "missing-title",
      category: "seo",
      severity: "critical",
      title: "Missing Page Title Tag",
      description: `${pagesMissingTitle.length} page(s) lack a <title> tag. Search engines rely on title tags to understand the core subject of your page.`,
      recommendation: "Add a unique and descriptive <title> tag to the <head> of every page.",
      pageUrl: missingTitleUrls[0] || normalizedUrl,
      affectedUrls: missingTitleUrls,
      evidence: `No <title> tag found on: ${missingTitleUrls.join(", ")}`,
    });
  }

  // Meta Description checks
  const pagesMissingDesc = pagesToEvaluate.filter((p) => !p.metaDescription || p.metaDescription.trim().length === 0);
  const pagesPoorDescLength = pagesToEvaluate.filter(
    (p) => p.metaDescription && (p.metaDescription.length < 70 || p.metaDescription.length > 165)
  );

  if (pagesMissingDesc.length === 0) {
    seoScore += 3;
    if (pagesPoorDescLength.length === 0) {
      seoScore += 3;
      passedChecks.push({
        category: "seo",
        title: "Meta Descriptions are Configured",
        description: "All crawled pages have meta descriptions between 70 and 165 characters.",
      });
    } else {
      seoScore += 1.5;
      const poorDescUrls = pagesPoorDescLength.map((p) => p.url);
      issues.push({
        id: "meta-description-length",
        category: "seo",
        severity: "warning",
        title: "Meta Description Length Not Optimal",
        description: `${pagesPoorDescLength.length} page(s) have descriptions under 70 or over 165 characters.`,
        recommendation: "Craft engaging meta descriptions between 120 and 160 characters to maximize organic click-through rates.",
        pageUrl: poorDescUrls[0] || normalizedUrl,
        affectedUrls: poorDescUrls,
        evidence: `Description length (${pagesPoorDescLength[0]?.metaDescriptionLength} chars) on ${poorDescUrls[0]}`,
      });
    }
  } else {
    const missingDescUrls = pagesMissingDesc.map((p) => p.url);
    issues.push({
      id: "missing-meta-description",
      category: "seo",
      severity: "critical",
      title: "Missing Meta Description",
      description: `${pagesMissingDesc.length} page(s) do not have a meta description tag. Search engines will pull arbitrary text snippets instead.`,
      recommendation: 'Add <meta name="description" content="..."> summarizing the page purpose.',
      pageUrl: missingDescUrls[0] || normalizedUrl,
      affectedUrls: missingDescUrls,
      evidence: `No meta description found on: ${missingDescUrls.join(", ")}`,
    });
  }

  // H1 Heading checks
  const pagesMissingH1 = pagesToEvaluate.filter((p) => !p.h1Count || p.h1Count === 0);
  const pagesMultipleH1 = pagesToEvaluate.filter((p) => p.h1Count > 1);

  if (pagesMissingH1.length === 0 && pagesMultipleH1.length === 0) {
    seoScore += 5;
    passedChecks.push({
      category: "seo",
      title: "Clean H1 Heading Usage",
      description: "Each crawled page contains exactly one primary <h1> heading.",
    });
  } else if (pagesMissingH1.length > 0) {
    seoScore += 1;
    const missingH1Urls = pagesMissingH1.map((p) => p.url);
    issues.push({
      id: "missing-h1",
      category: "seo",
      severity: "critical",
      title: "Missing H1 Heading",
      description: `${pagesMissingH1.length} page(s) lack an <h1> heading tag. The <h1> is a vital structural signal for search engines.`,
      recommendation: "Add exactly one meaningful <h1> heading containing your page focus topic.",
      pageUrl: missingH1Urls[0] || normalizedUrl,
      affectedUrls: missingH1Urls,
      evidence: `Found 0 <h1> tags on: ${missingH1Urls.join(", ")}`,
    });
  } else if (pagesMultipleH1.length > 0) {
    seoScore += 3;
    const multipleH1Urls = pagesMultipleH1.map((p) => p.url);
    issues.push({
      id: "multiple-h1",
      category: "seo",
      severity: "warning",
      title: "Multiple H1 Headings Detected",
      description: `${pagesMultipleH1.length} page(s) have more than one <h1> tag. Multiple H1s dilute page focus.`,
      recommendation: "Use a single <h1> heading for the main topic and use <h2>/<h3> for subsections.",
      pageUrl: multipleH1Urls[0] || normalizedUrl,
      affectedUrls: multipleH1Urls,
      evidence: `Found ${pagesMultipleH1[0]?.h1Count} <h1> tags on ${multipleH1Urls[0]}`,
    });
  }

  // Heading Structure
  const brokenHierarchy = pagesToEvaluate.filter((p) => p.headings && !p.headings.hasSequentialStructure);
  if (brokenHierarchy.length === 0) {
    seoScore += 3;
    passedChecks.push({
      category: "seo",
      title: "Sequential Heading Hierarchy",
      description: "Headings follow a logical sequential order (H1 -> H2 -> H3) without skipping levels.",
    });
  } else {
    const brokenHierarchyUrls = brokenHierarchy.map((p) => p.url);
    issues.push({
      id: "heading-structure",
      category: "seo",
      severity: "info",
      title: "Non-Sequential Heading Hierarchy",
      description: "Headings skip hierarchy levels (e.g. H3 used without preceding H2, or H2 without H1).",
      recommendation: "Maintain a nested heading structure (H1 -> H2 -> H3) to assist accessibility tools and web crawlers.",
      pageUrl: brokenHierarchyUrls[0] || normalizedUrl,
      affectedUrls: brokenHierarchyUrls,
      evidence: `Heading levels skipped on: ${brokenHierarchyUrls.join(", ")}`,
    });
  }

  // Word Count check
  const lowWordPages = pagesToEvaluate.filter((p) => p.wordCount < 250);
  if (lowWordPages.length === 0) {
    seoScore += 3;
    passedChecks.push({
      category: "seo",
      title: "Adequate Content Word Count",
      description: "Crawled pages have substantial content depth (>250 words).",
    });
  } else {
    seoScore += 1.5;
    const lowWordUrls = lowWordPages.map((p) => p.url);
    issues.push({
      id: "thin-content",
      category: "seo",
      severity: "warning",
      title: "Thin Content Detected",
      description: `${lowWordPages.length} page(s) have fewer than 250 words of visible text.`,
      recommendation: "Expand page content to thoroughly answer user search intent with valuable textual information.",
      pageUrl: lowWordUrls[0] || normalizedUrl,
      affectedUrls: lowWordUrls,
      evidence: `Word count (${lowWordPages[0]?.wordCount} words) on: ${lowWordUrls[0]}`,
    });
  }

  // Language declaration
  const missingLang = pagesToEvaluate.filter((p) => !p.lang);
  if (missingLang.length === 0) {
    seoScore += 3;
    passedChecks.push({
      category: "seo",
      title: "HTML Language Declared",
      description: "All pages specify an HTML lang attribute.",
    });
  } else {
    issues.push({
      id: "missing-html-lang",
      category: "seo",
      severity: "info",
      title: "Missing HTML Language Attribute",
      description: "The <html> tag does not specify a lang attribute.",
      recommendation: 'Add lang attribute to <html> tag (e.g. <html lang="en">).',
      pageUrl: missingLang[0]?.url,
      evidence: "<html> tag missing lang attribute.",
    });
  }

  // Duplicate Titles / Descriptions across crawled pages
  const titles = pagesToEvaluate.map((p) => p.title).filter(Boolean);
  const uniqueTitles = new Set(titles);
  if (titles.length === uniqueTitles.size) {
    seoScore += 2;
    passedChecks.push({
      category: "seo",
      title: "Unique Page Titles",
      description: "No duplicate title tags detected across the crawled pages.",
    });
  } else {
    issues.push({
      id: "duplicate-titles",
      category: "seo",
      severity: "warning",
      title: "Duplicate Page Titles Detected",
      description: "Multiple crawled pages share the exact same title tag.",
      recommendation: "Ensure every page on your site has a distinctive, unique title tag.",
      pageUrl: normalizedUrl,
      evidence: `${titles.length - uniqueTitles.size} duplicate title(s) found across crawled pages.`,
    });
  }

  const descriptions = pagesToEvaluate.map((p) => p.metaDescription).filter(Boolean);
  const uniqueDescriptions = new Set(descriptions);
  if (descriptions.length === uniqueDescriptions.size) {
    seoScore += 2;
    passedChecks.push({
      category: "seo",
      title: "Unique Meta Descriptions",
      description: "No duplicate meta descriptions found across crawled pages.",
    });
  } else {
    issues.push({
      id: "duplicate-descriptions",
      category: "seo",
      severity: "info",
      title: "Duplicate Meta Descriptions",
      description: "Multiple crawled pages share identical meta descriptions.",
      recommendation: "Write unique descriptions for distinct pages to prevent search snippets overlapping.",
      pageUrl: normalizedUrl,
      evidence: `${descriptions.length - uniqueDescriptions.size} duplicate description(s) across crawled pages.`,
    });
  }

  // ── CATEGORY 2: TECHNICAL SEO & CRAWLABILITY (Max: 25 pts) ────────────────
  let technicalScore = 0;

  // HTTPS check
  const isHttps = normalizedUrl.startsWith("https://");
  if (isHttps) {
    technicalScore += 7;
    passedChecks.push({
      category: "technical",
      title: "HTTPS Encryption Enabled",
      description: "The website is served over secure HTTPS with an active SSL certificate.",
    });
  } else {
    issues.push({
      id: "http-insecure",
      category: "technical",
      severity: "critical",
      title: "Website Not Using HTTPS",
      description: "The site is loaded over unencrypted HTTP. Major browsers flag HTTP sites as 'Not Secure' and search engines penalize rankings.",
      recommendation: "Install an SSL/TLS certificate and configure a 301 redirect from HTTP to HTTPS.",
      pageUrl: normalizedUrl,
      evidence: `Protocol is ${new URL(normalizedUrl).protocol}`,
    });
  }

  // Homepage status 200
  if (homePage.statusCode === 200) {
    technicalScore += 4;
    passedChecks.push({
      category: "technical",
      title: "Homepage Returns 200 OK Status",
      description: "The target website homepage responds with a successful HTTP 200 status code.",
    });
  } else {
    issues.push({
      id: "homepage-status",
      category: "technical",
      severity: "critical",
      title: `Unexpected Homepage Status (${homePage.statusCode})`,
      description: `Homepage returned status ${homePage.statusCode}.`,
      recommendation: "Verify web server configuration so public visitors receive HTTP 200 OK.",
      pageUrl: homePage.url || normalizedUrl,
      evidence: `HTTP status code: ${homePage.statusCode}`,
    });
  }

  // Mobile Viewport meta
  const hasViewport = Boolean(homePage.viewport);
  if (hasViewport) {
    technicalScore += 4;
    passedChecks.push({
      category: "technical",
      title: "Mobile Responsive Viewport Meta",
      description: "The page includes a responsive <meta name='viewport'> tag for mobile devices.",
    });
  } else {
    issues.push({
      id: "missing-viewport",
      category: "technical",
      severity: "critical",
      title: "Missing Mobile Viewport Tag",
      description: "No viewport meta tag was found. Mobile devices will render the desktop version zoomed out.",
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> in the <head>.',
      pageUrl: homePage.url || normalizedUrl,
      evidence: "No viewport meta tag detected.",
    });
  }

  // Canonical tag check
  const missingCanonical = pagesToEvaluate.filter((p) => !p.canonical);
  if (missingCanonical.length === 0) {
    technicalScore += 3;
    passedChecks.push({
      category: "technical",
      title: "Canonical URLs Configured",
      description: "All crawled pages declare a rel='canonical' URL to prevent duplicate content issues.",
    });
  } else {
    technicalScore += 1.5;
    const missingCanonicalUrls = missingCanonical.map((p) => p.url);
    issues.push({
      id: "missing-canonical",
      category: "technical",
      severity: "warning",
      title: "Missing Canonical Tag",
      description: `${missingCanonical.length} page(s) lack a canonical link element.`,
      recommendation: "Add <link rel='canonical' href='https://...'> to point search engines to the preferred master URL.",
      pageUrl: missingCanonicalUrls[0] || normalizedUrl,
      affectedUrls: missingCanonicalUrls,
      evidence: `Missing canonical tag on: ${missingCanonicalUrls.join(", ")}`,
    });
  }

  // Failed / Unreachable pages check
  if (failedPages.length > 0) {
    technicalScore = Math.max(0, technicalScore - failedPages.length * 2);
    const failedUrls = failedPages.map((p) => p.url);
    issues.push({
      id: "page-load-failure",
      category: "technical",
      severity: "critical",
      title: "Page Request Failed or Timed Out",
      description: `${failedPages.length} page(s) failed to respond or timed out during the crawl. These pages could not be evaluated for on-page SEO.`,
      recommendation: "Verify server resources, firewall rules, and timeouts so web crawlers can reach internal pages reliably.",
      pageUrl: failedUrls[0] || normalizedUrl,
      affectedUrls: failedUrls,
      evidence: `Failed or timed out: ${failedPages.map((p) => `${p.url} (${p.error || `HTTP ${p.statusCode}`})`).join(", ")}`,
    });
  }

  // Robots.txt check
  if (robotsInfo.exists) {
    technicalScore += 3;
    passedChecks.push({
      category: "technical",
      title: "robots.txt Detected",
      description: `Valid robots.txt found at ${origin}/robots.txt guiding search bot crawl behavior.`,
    });
  } else {
    issues.push({
      id: "missing-robots-txt",
      category: "technical",
      severity: "info",
      title: "robots.txt Not Found",
      description: `No robots.txt found at ${origin}/robots.txt.`,
      recommendation: "Create a robots.txt file at the domain root to inform search engines which directories to crawl or skip.",
      pageUrl: `${origin}/robots.txt`,
      evidence: `HTTP ${robotsInfo.statusCode || 404}`,
    });
  }

  // Sitemap.xml check
  if (sitemapInfo.exists || robotsInfo.sitemapUrl) {
    technicalScore += 2;
    passedChecks.push({
      category: "technical",
      title: "XML Sitemap Available",
      description: `XML sitemap found at ${sitemapInfo.url || robotsInfo.sitemapUrl}.`,
    });
  } else {
    issues.push({
      id: "missing-sitemap",
      category: "technical",
      severity: "warning",
      title: "XML Sitemap Not Detected",
      description: `Could not find an accessible XML sitemap at ${origin}/sitemap.xml or referenced in robots.txt.`,
      recommendation: "Generate an XML sitemap and submit it to Google Search Console to speed up indexation.",
      pageUrl: `${origin}/sitemap.xml`,
      evidence: "Sitemap request did not return valid XML.",
    });
  }

  // Structured Data check
  const hasStructured = crawledPages.some((p) => p.hasStructuredData);
  if (hasStructured) {
    technicalScore += 2;
    passedChecks.push({
      category: "technical",
      title: "Structured Data Schema Detected",
      description: "JSON-LD or Schema.org microdata was detected, enabling rich search snippets.",
    });
  } else {
    issues.push({
      id: "missing-structured-data",
      category: "technical",
      severity: "info",
      title: "No Structured Data (Schema.org) Found",
      description: "No JSON-LD or Microdata structured markup detected on crawled pages.",
      recommendation: "Add Schema.org JSON-LD (e.g. Organization, LocalBusiness, WebSite) for rich search results.",
      pageUrl: homePage.url || normalizedUrl,
      evidence: "No <script type='application/ld+json'> or microdata found.",
    });
  }

  // ── CATEGORY 3: LINKS & ARCHITECTURE (Max: 20 pts) ────────────────────────
  let linksScore = 0;

  // Broken internal links
  const brokenLinks = linksFindings.filter((l) => l.isBroken);
  if (brokenLinks.length === 0) {
    linksScore += 8;
    passedChecks.push({
      category: "links",
      title: "No Broken Internal Links",
      description: "All tested internal links responded with healthy status codes.",
    });
  } else {
    const penalty = Math.min(8, brokenLinks.length * 3);
    linksScore += Math.max(0, 8 - penalty);
    const brokenSourceUrls = [...new Set(brokenLinks.map((l) => l.sourceUrl))];
    issues.push({
      id: "broken-internal-links",
      category: "links",
      severity: "critical",
      title: "Broken Internal Links Detected",
      description: `Found ${brokenLinks.length} broken internal link(s) returning 404 or connection failures. Broken links waste crawl budget and harm user trust.`,
      recommendation: "Update or remove broken link destinations and configure 301 redirects where pages were moved.",
      pageUrl: brokenSourceUrls[0] || normalizedUrl,
      affectedUrls: brokenSourceUrls,
      evidence: `Broken target: ${brokenLinks[0]?.targetUrl} (Status: ${brokenLinks[0]?.statusCode}) found on ${brokenLinks[0]?.sourceUrl}`,
    });
  }

  // Empty anchor texts
  const emptyAnchors = linksFindings.filter((l) => !l.hasAnchorText);
  if (emptyAnchors.length === 0) {
    linksScore += 5;
    passedChecks.push({
      category: "links",
      title: "Descriptive Link Anchor Text",
      description: "All tested links contain clear anchor text or descriptive labels.",
    });
  } else {
    const penalty = Math.min(5, Math.ceil(emptyAnchors.length * 1.5));
    linksScore += Math.max(0, 5 - penalty);
    issues.push({
      id: "empty-anchor-text",
      category: "links",
      severity: "warning",
      title: "Links Missing Anchor Text",
      description: `Found ${emptyAnchors.length} link(s) with empty anchor text. Screen readers and search bots need descriptive text to understand destination context.`,
      recommendation: "Provide meaningful text inside all <a> tags or add aria-label attributes.",
      pageUrl: emptyAnchors[0]?.sourceUrl,
      evidence: `Target URL: ${emptyAnchors[0]?.targetUrl}`,
    });
  }

  // Internal link coverage
  if (linksFindings.length >= 5) {
    linksScore += 4;
    passedChecks.push({
      category: "links",
      title: "Solid Internal Link Architecture",
      description: `Found healthy link connectivity (${linksFindings.length}+ links discovered).`,
    });
  } else {
    linksScore += 2;
    issues.push({
      id: "low-internal-links",
      category: "links",
      severity: "info",
      title: "Low Internal Link Count",
      description: "Few internal links discovered on the crawled pages.",
      recommendation: "Add contextual internal links connecting related pages to distribute link equity.",
      pageUrl: normalizedUrl,
      evidence: `Only ${linksFindings.length} internal link(s) detected.`,
    });
  }

  // Clean URLs
  const queryParamPages = crawledPages.filter((p) => p.url.includes("?") && p.url.split("?")[1].length > 40);
  if (queryParamPages.length === 0) {
    linksScore += 3;
    passedChecks.push({
      category: "links",
      title: "Clean URL Structures",
      description: "URLs are clean, human-readable, and free from cluttered session query parameters.",
    });
  } else {
    linksScore += 1.5;
    issues.push({
      id: "unclean-urls",
      category: "links",
      severity: "info",
      title: "URLs Contain Long Query Strings",
      description: "Some page URLs contain complex parameters which can cause crawler traps.",
      recommendation: "Use clean, keyword-friendly path slugs instead of query parameters for static pages.",
      pageUrl: queryParamPages[0]?.url,
      evidence: `URL: ${queryParamPages[0]?.url}`,
    });
  }

  // ── CATEGORY 4: IMAGES & MEDIA (Max: 15 pts) ──────────────────────────────
  let imagesScore = 0;

  if (imagesFindings.length === 0) {
    imagesScore += 10;
    passedChecks.push({
      category: "images",
      title: "No Image Issues",
      description: "No problematic images were detected on crawled pages.",
    });
  } else {
    // Missing alt attribute
    const missingAlt = imagesFindings.filter((i) => !i.hasAlt);
    if (missingAlt.length === 0) {
      imagesScore += 6;
      passedChecks.push({
        category: "images",
        title: "All Images Have Alt Text",
        description: "All audited images provide descriptive alt text for accessibility and image search.",
      });
    } else {
      const penalty = Math.min(6, Math.ceil((missingAlt.length / imagesFindings.length) * 6));
      imagesScore += Math.max(0, 6 - penalty);
      issues.push({
        id: "missing-image-alt",
        category: "images",
        severity: "warning",
        title: "Images Missing Alt Text",
        description: `Found ${missingAlt.length} image(s) missing the 'alt' attribute. Alt text helps visually impaired visitors and indexes images in Google Images.`,
        recommendation: "Add descriptive alt attributes (e.g. alt='AddressGuru UAE Business Office') to every content image.",
        pageUrl: missingAlt[0]?.pageUrl,
        evidence: `Sample image URL: ${missingAlt[0]?.url}`,
      });
    }

    // Broken images
    const brokenImages = imagesFindings.filter((i) => i.statusCode >= 400 || i.statusCode === 0);
    if (brokenImages.length === 0) {
      imagesScore += 5;
      passedChecks.push({
        category: "images",
        title: "No Broken Images Found",
        description: "All tested image URLs resolved successfully.",
      });
    } else {
      const penalty = Math.min(5, brokenImages.length * 2.5);
      imagesScore += Math.max(0, 5 - penalty);
      issues.push({
        id: "broken-images",
        category: "images",
        severity: "critical",
        title: "Broken Image Links Detected",
        description: `Found ${brokenImages.length} image(s) returning 404 or connection errors.`,
        recommendation: "Fix or remove broken image links to avoid broken placeholder icons.",
        pageUrl: brokenImages[0]?.pageUrl,
        evidence: `Broken image: ${brokenImages[0]?.url} (Status: ${brokenImages[0]?.statusCode})`,
      });
    }

    // Missing width/height dimensions
    const missingDimensions = imagesFindings.filter((i) => !i.hasDimensions);
    if (missingDimensions.length === 0) {
      imagesScore += 4;
      passedChecks.push({
        category: "images",
        title: "Image Dimensions Specified",
        description: "Images include explicit width and height attributes preventing Cumulative Layout Shift (CLS).",
      });
    } else {
      imagesScore += 2;
      issues.push({
        id: "missing-image-dimensions",
        category: "images",
        severity: "info",
        title: "Images Lack Explicit Dimensions",
        description: `${missingDimensions.length} image(s) do not define width and height attributes. This can cause layout shifts as the page loads.`,
        recommendation: "Specify width and height attributes on <img> tags or set aspect-ratio in CSS.",
        pageUrl: missingDimensions[0]?.pageUrl,
        evidence: `Sample image: ${missingDimensions[0]?.url}`,
      });
    }
  }

  // ── CATEGORY 5: PERFORMANCE & SPEED (Max: 10 pts) ─────────────────────────
  let performanceScore = 0;

  // Response Time / TTFB
  const avgResponseTime = Math.round(
    crawledPages.reduce((acc, p) => acc + (p.responseTimeMs || 0), 0) / (crawledPages.length || 1)
  );

  if (avgResponseTime < 600) {
    performanceScore += 4;
    passedChecks.push({
      category: "performance",
      title: "Fast Server Response Time",
      description: `Average HTML download time was very fast (${avgResponseTime}ms, well under 600ms).`,
    });
  } else if (avgResponseTime < 1500) {
    performanceScore += 2.5;
    issues.push({
      id: "moderate-response-time",
      category: "performance",
      severity: "warning",
      title: "Moderate Server Response Time",
      description: `Average page response time was ${avgResponseTime}ms. Faster response times reduce bounce rate.`,
      recommendation: "Optimize database queries, enable server-side caching (Redis/OPcache), and use a UAE/regional CDN.",
      pageUrl: normalizedUrl,
      evidence: `Average response time: ${avgResponseTime}ms.`,
    });
  } else {
    issues.push({
      id: "slow-response-time",
      category: "performance",
      severity: "critical",
      title: "Slow Server Response Time",
      description: `Average response time was ${avgResponseTime}ms (>1500ms). Visitors and search bots may experience timeouts.`,
      recommendation: "Upgrade server hosting resources, implement page caching, and verify server load.",
      pageUrl: normalizedUrl,
      evidence: `Average response time: ${avgResponseTime}ms.`,
    });
  }

  // HTML page size
  const avgPageSizeKb = Math.round(
    crawledPages.reduce((acc, p) => acc + (p.pageSizeKb || 0), 0) / (crawledPages.length || 1)
  );

  if (avgPageSizeKb < 100) {
    performanceScore += 3;
    passedChecks.push({
      category: "performance",
      title: "Optimal HTML Document Size",
      description: `Average HTML page size is lean and fast (${avgPageSizeKb} KB, under 100 KB).`,
    });
  } else if (avgPageSizeKb < 250) {
    performanceScore += 1.5;
    issues.push({
      id: "moderate-html-size",
      category: "performance",
      severity: "info",
      title: "HTML Document Size Is Moderate",
      description: `Average HTML payload is ${avgPageSizeKb} KB.`,
      recommendation: "Minify HTML, remove inline SVG or base64 blobs, and defer unused code.",
      pageUrl: normalizedUrl,
      evidence: `Average HTML size: ${avgPageSizeKb} KB.`,
    });
  } else {
    issues.push({
      id: "large-html-size",
      category: "performance",
      severity: "warning",
      title: "Large HTML Payload",
      description: `Average HTML payload is ${avgPageSizeKb} KB (>250 KB). Heavy DOMs slow down parsing on mobile.`,
      recommendation: "Streamline DOM depth, externalize large inline styles/scripts, and enable text minification.",
      pageUrl: normalizedUrl,
      evidence: `Average HTML size: ${avgPageSizeKb} KB.`,
    });
  }

  // Compression Header (gzip/brotli)
  const isCompressed = crawledPages.some(
    (p) => p.contentEncoding && (p.contentEncoding.includes("gzip") || p.contentEncoding.includes("br"))
  );
  if (isCompressed) {
    performanceScore += 3;
    passedChecks.push({
      category: "performance",
      title: "HTTP Compression Enabled",
      description: "Web server serves compressed assets (gzip / brotli).",
    });
  } else {
    performanceScore += 1.5;
    issues.push({
      id: "missing-compression",
      category: "performance",
      severity: "info",
      title: "Gzip/Brotli Compression Notice",
      description: "Content-Encoding header did not report active compression on the response.",
      recommendation: "Enable Gzip or Brotli compression on your web server (Nginx/Apache/Cloudflare).",
      pageUrl: normalizedUrl,
      evidence: "Missing or uncompressed Content-Encoding header.",
    });
  }

  // ── UNAVAILABLE CHECKS (Marked clearly, 0 penalties) ──────────────────────
  unavailableChecks.push({
    category: "performance",
    title: "Core Web Vitals (LCP, INP, CLS)",
    reason: "Requires Chrome UX Report (CrUX) field data or headless browser laboratory instrumentation. Not measured in free automated crawl. (No score penalty applied)",
  });
  unavailableChecks.push({
    category: "seo",
    title: "Organic Keyword Rankings & Search Traffic",
    reason: "Requires authenticated Google Search Console & Google Analytics access. Not measured. (No score penalty applied)",
  });
  unavailableChecks.push({
    category: "links",
    title: "External Domain Authority & Backlink Graph",
    reason: "Requires multi-billion page web index. Not measured. (No score penalty applied)",
  });

  // Calculate final rounded category scores
  const finalCategoryScores = {
    seo: Math.min(30, Math.round(seoScore * 10) / 10),
    technical: Math.min(25, Math.round(technicalScore * 10) / 10),
    links: Math.min(20, Math.round(linksScore * 10) / 10),
    images: Math.min(15, Math.round(imagesScore * 10) / 10),
    performance: Math.min(10, Math.round(performanceScore * 10) / 10),
  };

  const totalRaw =
    finalCategoryScores.seo +
    finalCategoryScores.technical +
    finalCategoryScores.links +
    finalCategoryScores.images +
    finalCategoryScores.performance;

  const overallScore = Math.min(100, Math.max(0, Math.round(totalRaw)));

  let grade = "C";
  if (overallScore >= 85) grade = "A";
  else if (overallScore >= 70) grade = "B";
  else if (overallScore >= 50) grade = "C";
  else if (overallScore >= 35) grade = "D";
  else grade = "F";

  return {
    categoryScores: finalCategoryScores,
    overallScore,
    grade,
    issues,
    passedChecks,
    unavailableChecks,
  };
}
