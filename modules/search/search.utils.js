import CitiesSchema from "../../model/CitiesSchema.js";
import Category from "../../model/categoriesSchema.js";

// ── Stop Words ──────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "with",
  "near",
  "best",
  "in",
  "at",
  "for",
  "top",
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "from",
  "service",
  "services",
  "company",
  "companies",
  "good",
  "great",
  "cheap",
  "affordable",
  "nearby",
  "around",
  "me",
  "us",
  "my",
  "find",
  "show",
  "list",
  "get",
  "need",
  "want",
  "looking",
  "please",
  "help",
  "tell",
  "can",
  "i",
  "is",
  "are",
  "was",
  "were",
]);

// ── City cache ────────────────────────────────────────────────────────────────
let cachedCityWords = null;

export const getCityWords = async () => {
  if (cachedCityWords) return cachedCityWords;

  const cities = await CitiesSchema.find({}, { name: 1 }).lean();

  cachedCityWords = cities
    .map((c) => c.name.toLowerCase())
    .sort((a, b) => b.length - a.length);

  return cachedCityWords;
};

// ── Category cache ────────────────────────────────────────────────────────────
let cachedCategoryIndex = null;

export const getCategoryIndex = async () => {
  if (cachedCategoryIndex) return cachedCategoryIndex;

  const categories = await Category.find(
    { isDeleted: false, isActive: true },
    { name: 1, tags: 1, slug: 1 },
  ).lean();

  const index = [];

  for (const cat of categories) {
    const name = cat.name.toLowerCase();

    // category name
    index.push({
      kw: name,
      category: cat.name,
      slug: cat.slug,
      tags: cat.tags || [],
    });

    // tags
    if (Array.isArray(cat.tags)) {
      for (const tag of cat.tags) {
        index.push({
          kw: tag.toLowerCase(),
          category: cat.name,
          slug: cat.slug,
          tags: cat.tags,
        });
      }
    }
  }

  cachedCategoryIndex = index.sort((a, b) => b.kw.length - a.kw.length);
  return cachedCategoryIndex;
};

// ── Query parser ──────────────────────────────────────────────────────────────
export const parseSearchQuery = async (query) => {
  const normalized = query.toLowerCase().trim();

  const [cityWords, categoryIndex] = await Promise.all([
    getCityWords(),
    getCategoryIndex(),
  ]);

  // ── Step 1: Detect city ─────────────────────────────
  let detectedCity = null;
  let remainingQuery = normalized;

  for (const city of cityWords) {
    if (normalized.includes(city)) {
      detectedCity = city;
      remainingQuery = normalized
        .replace(city, " ")
        .replace(/\s+/g, " ")
        .trim();
      break;
    }
  }

  // ── Step 2: Detect category ──────────────────────────
  let detectedCategory = null;
  let detectedCategorySlug = null;
  let detectedCategoryTags = [];

  for (const { kw, category, slug, tags } of categoryIndex) {
    if (remainingQuery.includes(kw)) {
      detectedCategory = category;
      detectedCategorySlug = slug;
      detectedCategoryTags = tags;
      break;
    }
  }

  // ── Step 3: Topic keywords fallback ───────────────────
  const topicKeywords = !detectedCategory
    ? remainingQuery
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    : [];

  return {
    topicKeywords,
    detectedCity,
    detectedCategory,
    detectedCategorySlug,
    categoryKeywords: detectedCategoryTags,
    normalizedQuery: normalized,
  };
};

// ── Build search text (SINGLE CLEAN VERSION) ───────────
export const buildSearchText = ({
  businessName = "",
  description = "",
  categoryName = "",
  featureNames = [],
  categoryTags = [],
}) => {
  return [
    businessName,
    description,
    categoryName,
    ...categoryTags,
    ...featureNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};
