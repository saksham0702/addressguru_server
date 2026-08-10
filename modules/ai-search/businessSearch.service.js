import BusinessListing from "../../model/businessListingSchema.js";
import { embedText, generateJSON } from "./gemini.client.js";
import { cosineSimilarity } from "./businessEmbedding.service.js";

const TOP_K_CANDIDATES = 18;

setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of queryCache.entries()) {
      if (val.expiresAt <= now) queryCache.delete(key);
    }
  },
  10 * 60 * 1000,
);
let cache = [];
let cacheLoadedAt = null;
const queryCache = new Map(); // key: lowercased query, value: { data, expiresAt }
const QUERY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export const loadBusinessEmbeddingCache = async () => {
  const listings = await BusinessListing.find({
    isDeleted: false,
    status: "approved",
    isPublished: true,
    aiEmbedding: { $exists: true, $ne: [] },
  })
    .select("businessName slug category subCategory aiEmbedding")
    .populate("category", "name")
    .populate("subCategory", "name")
    .lean();

  cache = listings.map((l) => ({
    id: l._id.toString(),
    businessName: l.businessName,
    categoryName: l.category?.name || "",
    subCategoryName: l.subCategory?.name || "",
    embedding: l.aiEmbedding,
  }));

  cacheLoadedAt = new Date();
  console.log(`✅ AI business search cache loaded: ${cache.length} listings`);
  return cache.length;
};

export const getCacheStatus = () => ({
  count: cache.length,
  loadedAt: cacheLoadedAt,
});

export const upsertCacheEntry = async (listingId) => {
  const l = await BusinessListing.findOne({
    _id: listingId,
    isDeleted: false,
    status: "approved",
    isPublished: true,
  })
    .select("businessName slug category subCategory aiEmbedding")
    .populate("category", "name")
    .populate("subCategory", "name")
    .lean();

  cache = cache.filter((c) => c.id !== listingId.toString());

  if (l && l.aiEmbedding?.length) {
    cache.push({
      id: l._id.toString(),
      businessName: l.businessName,
      categoryName: l.category?.name || "",
      subCategoryName: l.subCategory?.name || "",
      embedding: l.aiEmbedding,
    });
  }
};

const buildRerankPrompt = (userQuery, candidates) => {
  const listBlock = candidates
    .map(
      (c, i) =>
        `${i + 1}. id: ${c.id}\n   name: ${c.businessName}\n   category: ${c.categoryName}${c.subCategoryName ? " > " + c.subCategoryName : ""}`,
    )
    .join("\n\n");

  return `You are filtering a business directory search for a UAE classifieds website.

User's request: "${userQuery}"

Below are candidate businesses, pre-filtered by semantic similarity (which is imperfect and can include loosely-related results). Return ONLY the businesses that are genuinely, sensibly relevant to what the user is asking for. Reject anything only superficially related. If none are truly relevant, return an empty array.

Candidates:
${listBlock}

Respond ONLY with a JSON array, no other text, exact shape:
[{"id": "<id>", "reason": "<one short sentence, under 15 words>"}]

Order from most to least relevant. Never include an id that is not in the candidate list. Never invent an id.`;
};

export const searchBusinesses = async (userQuery) => {
  if (!userQuery || !userQuery.trim())
    throw new Error("searchBusinesses: query is empty");

  const cacheKey = userQuery.trim().toLowerCase();
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (!cache.length) await loadBusinessEmbeddingCache();
  if (!cache.length) {
    return {
      message: "No businesses are available to search right now.",
      results: [],
    };
  }

  const queryVector = await embedText(userQuery);

  const scored = cache
    .map((entry) => ({
      ...entry,
      score: cosineSimilarity(queryVector, entry.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K_CANDIDATES);

  if (!scored.length) {
    return { message: buildResultMessage(userQuery, []), results: [] };
  }

  let ranked;
  try {
    ranked = await generateJSON(buildRerankPrompt(userQuery, scored));
  } catch (err) {
    console.warn(
      "AI rerank failed, falling back to similarity order:",
      err.message,
    );
    ranked = scored.slice(0, 8).map((s) => ({ id: s.id, reason: null }));
  }
  if (!Array.isArray(ranked)) {
    return { message: buildResultMessage(userQuery, []), results: [] };
  }

  const candidateIds = new Set(scored.map((s) => s.id));
  const validRanked = ranked.filter((r) => r?.id && candidateIds.has(r.id));
  if (!validRanked.length) {
    return { message: buildResultMessage(userQuery, []), results: [] };
  }

  const docs = await BusinessListing.find({
    _id: { $in: validRanked.map((r) => r.id) },
    isDeleted: false,
    status: "approved",
    isPublished: true,
  })
    .select(
      "businessName slug logo businessAddress description mobileNumber countryCode websiteLink",
    )
    .populate("category", "name")
    .populate("subCategory", "name")
    .lean();

  const docsById = new Map(docs.map((d) => [d._id.toString(), d]));

  const finalResults = validRanked
    .map((r) => {
      const doc = docsById.get(r.id);
      if (!doc) return null;
      return {
        id: doc._id,
        businessName: doc.businessName,
        slug: doc.slug,
        logo: doc.logo,
        category: doc.category?.name || null,
        subCategory: doc.subCategory?.name || null,
        businessAddress: doc.businessAddress,
        description: doc.description,
        websiteLink: doc.websiteLink,
        contact: {
          countryCode: doc.countryCode,
          mobileNumber: doc.mobileNumber,
        },
        reason: r.reason || null,
      };
    })
    .filter(Boolean);

  const finalResponse = {
    message: buildResultMessage(userQuery, finalResults),
    results: finalResults,
  };

  queryCache.set(cacheKey, {
    data: finalResponse,
    expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
  });

  return finalResponse;
};

const buildResultMessage = (userQuery, results) => {
  if (!results.length) {
    return "I couldn't find a business that matches your request. Try rephrasing what you're looking for.";
  }

  const topCategory = results[0].category;
  const sameCategory = results.every((r) => r.category === topCategory);

  const count = results.length;
  const countLabel = count === 1 ? "business" : "businesses";

  if (sameCategory && topCategory) {
    return `Here are the top ${count} ${countLabel} we found under ${topCategory} that match your request — you should enquire with these:`;
  }
  return `Here are the top ${count} ${countLabel} that best match your request:`;
};

export default {
  loadBusinessEmbeddingCache,
  upsertCacheEntry,
  searchBusinesses,
  getCacheStatus,
};
