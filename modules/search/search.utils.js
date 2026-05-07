import CitiesSchema from "../../model/CitiesSchema.js";

export const categoryKeywordsMap = {
  gym: ["gym", "fitness", "workout", "training", "exercise", "weights"],
  hotel: ["hotel", "resort", "stay", "lodging", "accommodation", "rooms"],
  school: [
    "school",
    "education",
    "academy",
    "learning",
    "college",
    "institute",
  ],
  restaurant: ["restaurant", "food", "dining", "cuisine", "cafe", "eatery"],
  seo: [
    "seo",
    "search engine optimization",
    "digital marketing",
    "rankings",
    "backlinks",
  ],
  taxi: ["taxi", "cab", "ride", "transport", "driver", "hire"],
  hospital: [
    "hospital",
    "clinic",
    "healthcare",
    "medical",
    "doctor",
    "treatment",
  ],
};

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
]);

// ── City cache ────────────────────────────────────────────────────────────────
let cachedCityWords = null;

export const getCityWords = async () => {
  if (cachedCityWords) return cachedCityWords;
  const cities = await CitiesSchema.find({}, { name: 1 }).lean();
  // Sort longest first so "abu dhabi" matches before "abu"
  cachedCityWords = cities
    .map((c) => c.name.toLowerCase())
    .sort((a, b) => b.length - a.length);
  return cachedCityWords;
};

// ── Query parser ──────────────────────────────────────────────────────────────
export const parseSearchQuery = async (query) => {
  const normalized = query.toLowerCase().trim();
  const cityWords = await getCityWords();

  let detectedCity = null;
  let remainingQuery = normalized;

  for (const city of cityWords) {
    if (normalized.includes(city)) {
      detectedCity = city;
      remainingQuery = normalized.replace(city, "").trim();
      break;
    }
  }

  const topicKeywords = remainingQuery
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  return { topicKeywords, detectedCity, normalizedQuery: normalized };
};

// ── Build searchText (NO city inside) ────────────────────────────────────────
export const buildSearchText = ({
  businessName = "",
  description = "",
  categoryName = "",
  featureNames = [],
}) => {
  const keywords = categoryKeywordsMap[categoryName.toLowerCase()] || [];

  return [
    businessName,
    description,
    categoryName,
    keywords.join(" "),
    featureNames.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};
