import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const GENERATIVE_MODEL = "gemini-2.5-flash";

let ai = null;

const getClient = () => {
  if (ai) return ai;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  ai = new GoogleGenAI({ apiKey });
  return ai;
};

export const embedText = async (text) => {
  if (!text || !text.trim()) throw new Error("embedText: text is empty");

  const response = await getClient().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });

  const values = response?.embeddings?.[0]?.values;
  if (!values || !values.length) {
    throw new Error("embedText: no embedding returned from Gemini");
  }
  return values;
};

export const generateJSON = async (prompt) => {
  const response = await getClient().models.generateContent({
    model: GENERATIVE_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const text = response?.text;
  if (!text) throw new Error("generateJSON: empty response from Gemini");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`generateJSON: could not parse Gemini output: ${text}`);
  }
};

export default { embedText, generateJSON };
