import { GoogleGenAI } from "@google/genai";
import Category from "../model/categoriesSchema.js";
import City from "../model/CitiesSchema.js";

/**
 * Generate SEO title and meta description.
 * Rules:
 * - Meta Title: defaults to title/businessName
 * - Meta Description:
 *     AI generated if available.
 *     Fallback template:
 *       - Business: "{businessName} - {categoryName} available in {localityName}, {cityName}."
 *       - Marketplace: "{productTitle} available in {localityName}, {cityName}."
 *       - Property: "{propertyTitle} - {categoryName} is available at {localityName}, {cityName} for {purpose}."
 */
export async function autoGenerateSeo({
  type = "business", // "business" | "marketplace" | "property"
  title = "",
  description = "",
  categoryId = null,
  categoryName: passedCatName = "",
  cityId = null,
  cityName: passedCityName = "",
  locality = "",
  purpose = "rent",
  existingSeo = {},
}) {
  const seoTitle = existingSeo?.title?.trim() || title?.trim() || "";

  // If description already explicitly provided by admin, keep it
  if (existingSeo?.description && existingSeo.description.trim().length > 10) {
    return {
      title: seoTitle,
      description: existingSeo.description.trim(),
    };
  }

  // Resolve Category Name
  let resolvedCategoryName = passedCatName || "";
  if (!resolvedCategoryName && categoryId) {
    try {
      const catDoc = await Category.findById(categoryId).select("name");
      resolvedCategoryName = catDoc?.name || "";
    } catch {
      resolvedCategoryName = "";
    }
  }

  // Resolve City Name
  let resolvedCityName = passedCityName || "";
  if (!resolvedCityName && cityId) {
    try {
      const cityDoc = await City.findById(cityId).select("name");
      resolvedCityName = cityDoc?.name || "";
    } catch {
      resolvedCityName = "";
    }
  }

  const loc = locality?.trim() || "";
  const city = resolvedCityName?.trim() || "";
  const locationText = loc && city ? `${loc}, ${city}` : loc || city || "UAE";
  const catText = resolvedCategoryName?.trim() || "";

  // Deterministic fallback templates
  let fallbackDesc = "";
  if (type === "business") {
    fallbackDesc = catText
      ? `${title} - ${catText} available in ${locationText}.`
      : `${title} available in ${locationText}.`;
  } else if (type === "marketplace") {
    fallbackDesc = `${title} available in ${locationText}.`;
  } else if (type === "property") {
    const formattedPurpose = purpose?.trim() ? purpose.toLowerCase() : "sale/rent";
    fallbackDesc = catText
      ? `${title} - ${catText} is available at ${locationText} for ${formattedPurpose}.`
      : `${title} is available at ${locationText} for ${formattedPurpose}.`;
  } else {
    fallbackDesc = `${title} available in ${locationText}.`;
  }

  // Attempt Gemini AI generation if key is present
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Write an engaging, SEO-optimized meta description (strictly 140 to 160 characters, no quotes, no emojis, no special characters, professional and concise) for this classified/directory listing:
Title: "${title}"
Category: "${catText}"
Location: "${locationText}"
Context: "${fallbackDesc}"
Overview: "${(description || "").substring(0, 300)}"
Provide ONLY the final description text.`;

      const response = await Promise.race([
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI timeout")), 4000)
        ),
      ]);

      const candidateText = response?.text?.trim();
      if (candidateText && candidateText.length >= 40) {
        const cleaned = candidateText
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
          .replace(/[✨🎉🌟⭐💫🔥👍✓✔️❤️"']/g, "")
          .trim();
        const finalDesc =
          cleaned.length > 160 ? cleaned.substring(0, 157) + "..." : cleaned;
        return {
          title: seoTitle,
          description: finalDesc,
        };
      }
    } catch (err) {
      console.warn("AI SEO description generation fallback to template:", err.message);
    }
  }

  return {
    title: seoTitle,
    description: fallbackDesc,
  };
}

