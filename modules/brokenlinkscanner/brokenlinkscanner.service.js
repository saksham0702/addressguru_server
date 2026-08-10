// brokenlinkscanner.service.js
import * as cheerio from "cheerio";

import Blog from "../../model/blogsSchema.js";
import Job from "../../model/jobsListingSchema.js";
import MarketplaceListing from "../../model/marketplaceListingSchema.js";
import PropertyListing from "../../model/propertiesListingSchema.js";
import BusinessListing from "../../model/businessListingSchema.js";
import Category from "../../model/categoriesSchema.js";
import City from "../../model/CitiesSchema.js";

import BrokenLinkScanner from "./brokernlinkscanner.model.js";
import ScanProgress from "./brokenlinkscanner.progress.model.js";

const BASE_URL = "https://addressguru.ae";
const FETCH_TIMEOUT_MS = 20000; // hard cap per link, covers HEAD + GET combined
const LINK_CONCURRENCY = 10; // small batch, not a full queue system
const PAGES_PER_RUN = 30; // cap pages scanned per run so we don't hammer the server

export let shouldStop = false;
export function cancelScanner() {
  shouldStop = true;
}

async function getAllUrls() {
  const urls = [
    "/",
    "/about",
    "/contact",
    "/blogs",
    "/jobs",
    "/marketplace",
    "/property",
  ];

  try {
    const blogs = await Blog.find({ status: "published" }, "slug");
    blogs.forEach((blog) => urls.push(`/blogs/${blog.slug}`));
  } catch (err) {
    console.log("Failed to fetch blogs:", err.message);
  }

  try {
    const jobs = await Job.find(
      { isPublished: true, isDeleted: false },
      "slug",
    );
    jobs.forEach((job) => urls.push(`/jobs/${job.slug}`));
  } catch (err) {
    console.log("Failed to fetch jobs:", err.message);
  }

  try {
    const marketplace = await MarketplaceListing.find(
      { isPublished: true, isDeleted: false },
      "slug",
    );
    marketplace.forEach((item) => urls.push(`/marketplace/${item.slug}`));
  } catch (err) {
    console.log("Failed to fetch marketplace:", err.message);
  }

  try {
    const properties = await PropertyListing.find(
      { isPublished: true, isDeleted: false },
      "slug",
    );
    properties.forEach((property) => urls.push(`/property/${property.slug}`));
  } catch (err) {
    console.log("Failed to fetch properties:", err.message);
  }

  try {
    const businesses = await BusinessListing.find(
      { isPublished: true, isDeleted: false },
      "slug",
    );
    businesses.forEach((business) => urls.push(`/${business.slug}`));
  } catch (err) {
    console.log("Failed to fetch businesses:", err.message);
  }

  try {
    const cities = await City.find({ status: true }, "slug");
    const categories = await Category.find(
      { isActive: true, isDeleted: false },
      "slug",
    );

    for (const city of cities) {
      for (const category of categories) {
        urls.push(`/${city.slug}/${category.slug}`);
      }
    }
  } catch (err) {
    console.log("Failed to fetch cities/categories:", err.message);
  }

  return urls;
}

// extract links
function extractLinks(html) {
  const $ = cheerio.load(html);
  const links = [];

  $("a[href]").each((_, element) => {
    let href = $(element).attr("href");

    if (!href) return;

    href = href.trim();

    if (href.startsWith("#")) return;
    if (href.startsWith("mailto:")) return;
    if (href.startsWith("tel:")) return;
    if (href.startsWith("javascript:")) return;

    links.push(href);
  });

  return [...new Set(links)];
}

// fetch with a single shared timeout across both HEAD + GET attempts
async function fetchWithTimeout(url, options = {}, controller) {
  return await fetch(url, {
    ...options,
    signal: controller.signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...options.headers,
    },
  });
}

// check a single link (HEAD first, fallback to GET) — capped at FETCH_TIMEOUT_MS total
async function checkLink(link) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response = await fetchWithTimeout(
      link,
      { method: "HEAD", redirect: "follow" },
      controller,
    );

    // some servers don't support HEAD properly, retry with GET
    if (!response.ok) {
      response = await fetchWithTimeout(
        link,
        { method: "GET", redirect: "follow" },
        controller,
      );
    }

    return { success: response.ok, status: response.status, error: "" };
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return {
      success: false,
      status: 0,
      error: isTimeout ? `Timeout after ${FETCH_TIMEOUT_MS}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// save broken link
async function saveBrokenLink(sourcePage, brokenLink, statusCode, error) {
  await BrokenLinkScanner.create({
    sourcePage,
    brokenLink,
    statusCode,
    error,
    checkedAt: new Date(),
  });
}

// run an array of async tasks with a concurrency cap
async function runInBatches(items, worker, limit) {
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    await Promise.all(batch.map(worker));
  }
}

// scan a single page (the page itself also gets the same 5s cap via checkLink-style timeout)
async function scanPage(pageUrl, linkCache) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}${pageUrl}`,
      {},
      controller,
    );

    if (!response.ok) return;

    const html = await response.text();
    const links = extractLinks(html);

    await runInBatches(
      links,
      async (link) => {
        const absoluteLink = link.startsWith("/") ? BASE_URL + link : link;

        if (linkCache.has(absoluteLink)) {
          const cached = linkCache.get(absoluteLink);
          if (!cached.success) {
            await saveBrokenLink(
              pageUrl,
              absoluteLink,
              cached.status,
              cached.error,
            );
          }
          return;
        }

        const result = await checkLink(absoluteLink);
        linkCache.set(absoluteLink, result);

        if (!result.success) {
          await saveBrokenLink(
            pageUrl,
            absoluteLink,
            result.status,
            result.error,
          );
        }
      },
      LINK_CONCURRENCY,
    );
  } catch (err) {
    console.log(`Failed to scan ${pageUrl}:`, err.message);
  } finally {
    clearTimeout(timer);
  }
}

// get (or create) the single progress/cursor document
async function getProgress() {
  let progress = await ScanProgress.findOne({ key: "brokenLinkScanCursor" });
  if (!progress) {
    progress = await ScanProgress.create({
      key: "brokenLinkScanCursor",
      cursor: 0,
    });
  }
  return progress;
}

// run scanner — only scans up to `limit` pages per call, resuming from where it left off
async function runScanner(limit = PAGES_PER_RUN) {
  console.log("Starting Broken Link Scan...");
  shouldStop = false;

  const urls = await getAllUrls();
  console.log(`Total pages tracked: ${urls.length}`);

  if (urls.length === 0) {
    console.log("No URLs to scan, aborting run");
    return;
  }

  const progress = await getProgress();
  const start = progress.cursor % urls.length;

  // take the next `limit` pages, wrapping around to the start if we hit the end of the list
  const pagesThisRun = Math.min(limit, urls.length);
  const batch = [];
  for (let i = 0; i < pagesThisRun; i++) {
    batch.push(urls[(start + i) % urls.length]);
  }

  console.log(`Scanning ${batch.length} pages (cursor was at index ${start})`);

  // only clear old broken-link rows for the pages we're re-checking right now —
  // this preserves findings for pages not yet revisited in this cycle
  await BrokenLinkScanner.deleteMany({ sourcePage: { $in: batch } });

  const linkCache = new Map();

  for (const page of batch) {
    if (shouldStop) {
      console.log("Scan cancelled by user stop request.");
      break;
    }
    console.log("Scanning:", page);
    await scanPage(page, linkCache);
  }

  // advance the cursor so tomorrow's run picks up right after this batch
  const nextCursor = (start + batch.length) % urls.length;
  progress.cursor = nextCursor;
  progress.updatedAt = new Date();
  await progress.save();

  console.log(
    `Broken Link Scan Completed. Next run will start at index ${nextCursor}`,
  );
}

export default runScanner;
