import CitiesSchema from "../../model/CitiesSchema.js";

export const categoryKeywordsMap = {
  gym: ["gym", "fitness", "workout", "training", "exercise", "weights", "crossfit", "pilates", "yoga", "zumba", "bodybuilding"],
  hotel: ["hotel", "resort", "stay", "lodging", "accommodation", "rooms", "inn", "motel", "hostel", "guesthouse", "suites"],
  school: ["school", "education", "academy", "learning", "college", "institute", "tuition", "coaching", "classes", "tutoring", "kindergarten"],
  restaurant: ["restaurant", "food", "dining", "cuisine", "cafe", "eatery", "bistro", "diner", "canteen", "takeaway", "dhaba", "tiffin"],
  accountant: ["accountant", "accounting", "ca", "chartered accountant", "audit", "tax", "gst", "bookkeeping", "finance", "tally", "income tax", "taxation", "itr", "balance sheet"],
  digitalmarketing: ["seo", "search engine optimization", "digital marketing", "rankings", "backlinks", "ppc", "google ads", "sem", "social media marketing"],
  taxi: ["taxi", "cab", "ride", "transport", "driver", "hire", "auto", "rickshaw", "car rental", "chauffeur", "pickup", "drop"],
  hospital: ["hospital", "clinic", "healthcare", "medical", "doctor", "treatment", "nursing", "surgery", "pharmacy", "diagnostic", "pathology", "nursing home"],
  architect: ["architect", "architecture", "building design", "blueprint", "construction design", "structural design", "drafting", "floor plan", "elevation", "autocad"],
  lawyer: ["lawyer", "advocate", "attorney", "legal", "law firm", "solicitor", "court", "litigation", "legal advice", "counsel", "vakil", "notary"],
  salon: ["salon", "hair", "beauty", "parlour", "parlor", "haircut", "styling", "grooming", "spa", "waxing", "threading", "manicure", "pedicure", "facial", "makeup"],
  realEstate: ["real estate", "property", "plot", "flat", "apartment", "house", "villa", "rent", "lease", "broker", "builder", "pg", "paying guest"],
  electrician: ["electrician", "electrical", "wiring", "circuit", "switch", "panel", "socket", "electrical repair", "electrical installation", "inverter", "ups"],
  plumber: ["plumber", "plumbing", "pipe", "leak", "drainage", "water tank", "tap", "fixture", "bathroom fitting", "sanitary"],
  photography: ["photographer", "photography", "photo", "shoot", "portrait", "wedding photography", "videography", "camera", "studio", "event photography", "maternity shoot"],
  it: ["software", "it company", "web development", "app development", "developer", "programming", "website", "mobile app", "cloud", "tech support", "erp", "crm"],
  coaching: ["coaching", "coach", "tutor", "tutorial", "preparation", "entrance exam", "competitive exam", "iit", "jee", "neet", "upsc", "ssc", "bank exam"],
  interior: ["interior", "interior design", "interior decorator", "furnishing", "decor", "modular kitchen", "furniture", "renovation", "false ceiling", "wallpaper"],
  event: ["event", "event management", "wedding planner", "decorator", "organizer", "party planner", "stage", "sound system", "dj", "tent house"],
  printing: ["printing", "print", "banner", "flex", "visiting card", "brochure", "stationery", "offset printing", "digital printing", "packaging", "labels"],
  pest: ["pest control", "pest", "termite", "cockroach", "mosquito", "rodent", "fumigation", "exterminator", "bedbug"],
  astrology: ["astrologer", "astrology", "horoscope", "jyotish", "vastu", "numerology", "palmistry", "pandit", "puja"],
  bakery: ["bakery", "cake", "pastry", "bread", "sweets", "confectionery", "dessert", "biscuit", "cookies", "mithai"],
};

// ── Flat map: keyword → category name ────────────────────────────────────────
// Sorted by keyword length (longest first) so multi-word phrases match before single words
export const buildCategoryKeywordIndex = () => {
  const index = [];
  for (const [category, keywords] of Object.entries(categoryKeywordsMap)) {
    for (const kw of keywords) {
      index.push({ kw: kw.toLowerCase(), category });
    }
  }
  // Longest keywords first so "chartered accountant" matches before "accountant"
  index.sort((a, b) => b.kw.length - a.kw.length);
  return index;
};

const CATEGORY_KEYWORD_INDEX = buildCategoryKeywordIndex();

const STOP_WORDS = new Set([
  "with", "near", "best", "in", "at", "for", "top", "a", "an", "the",
  "and", "or", "to", "from", "service", "services", "company", "companies",
  "good", "great", "cheap", "affordable", "nearby", "around", "me", "us",
  "my", "find", "show", "list", "get", "need", "want", "looking", "please",
  "help", "tell", "can", "i", "is", "are", "was", "were",
]);

// ── City cache ────────────────────────────────────────────────────────────────
let cachedCityWords = null;

export const getCityWords = async () => {
  if (cachedCityWords) return cachedCityWords;
  const cities = await CitiesSchema.find({}, { name: 1 }).lean();
  // Sort longest first so "new delhi" matches before "delhi"
  cachedCityWords = cities
    .map((c) => c.name.toLowerCase())
    .sort((a, b) => b.length - a.length);
  return cachedCityWords;
};

// ── Query parser ──────────────────────────────────────────────────────────────
export const parseSearchQuery = async (query) => {
  const normalized = query.toLowerCase().trim();
  const cityWords = await getCityWords();

  // ── Step 1: Detect city (exact substring match, longest first) ────────────
  let detectedCity = null;
  let remainingQuery = normalized;

  for (const city of cityWords) {
    if (normalized.includes(city)) {
      detectedCity = city;
      remainingQuery = normalized.replace(city, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  // ── Step 2: Detect category from remaining query (longest keyword first) ──
  let detectedCategory = null;
  let detectedCategoryKeywords = [];

  for (const { kw, category } of CATEGORY_KEYWORD_INDEX) {
    if (remainingQuery.includes(kw)) {
      detectedCategory = category;
      detectedCategoryKeywords = categoryKeywordsMap[category];
      break;
    }
  }

  // ── Step 3: Fallback topic keywords (only used when no category detected) ──
  const topicKeywords = !detectedCategory
    ? remainingQuery
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    : [];

  return {
    topicKeywords,        // used for free-text search (no category mode)
    detectedCity,         // if set → strict city filter applied
    detectedCategory,     // if set → strict category filter applied
    categoryKeywords: detectedCategoryKeywords, // all synonyms for detected category
    normalizedQuery: normalized,
  };
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