import BusinessListing from "../../model/businessListingSchema.js";
import { embedText } from "./gemini.client.js";
import { buildEmbeddingText } from "./embeddingText.builder.js";

export const generateEmbeddingForListing = async (listingId) => {
  const listing = await BusinessListing.findById(listingId).lean();
  if (!listing) return null;

  const text = await buildEmbeddingText(listing);
  const vector = await embedText(text);

  await BusinessListing.findByIdAndUpdate(listingId, {
    $set: { aiEmbedding: vector, aiEmbeddingUpdatedAt: new Date() },
  });

  return vector;
};

export const cosineSimilarity = (a, b) => {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export default { generateEmbeddingForListing, cosineSimilarity };
