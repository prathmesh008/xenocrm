'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("Server misconfiguration: GEMINI_API_KEY is missing.");
}

// Initialize the official SDK
const genAI = new GoogleGenerativeAI(apiKey);

// The SDK automatically resolves the correct endpoints for this model
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Universal internal SDK fetcher
async function callGemini(prompt: string, expectJson: boolean = false) {
  try {
    const generationConfig = expectJson ? { responseMimeType: "application/json" } : {};
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig
    });
    
    let text = result.response.text();
    
    if (expectJson) {
      // 🛡️ BULLETPROOFING: Strip out markdown blocks if Gemini hallucinates them
      text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
      return JSON.parse(text);
    }
    
    return text.replace(/^["']|["']$/g, '').trim();
    
  } catch (error: any) {
    console.error("Gemini SDK Error:", error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
}

// 1. Parse Rules
export async function parseSegmentRules(userInput: string) {
  const prompt = `
  Translate the user's text into a JSON array of rule objects for a CRM.
  Valid fields: 'spend', 'visits', 'orders', 'avg_order_value', 'clv', 'preferred_category', 'source'.
  Valid operators: '>', '<', '=', '>=', '<='.
  Rule object format: {"field": "spend", "operator": ">", "value": "1000", "connector": "AND"}
  Return ONLY a raw JSON array. Do not wrap in markdown.
  User text: "${userInput}"
  `;
  return callGemini(prompt, true);
}

// 2. Generate Objective
export async function generateCampaignObjective(rules: any) {
  const prompt = `Based on these audience rules, generate a short 4-6 word campaign objective title. Return ONLY the text, no quotes. Rules: ${JSON.stringify(rules)}`;
  return callGemini(prompt, false);
}

// 3. Generate Messages
export async function generateMessageSuggestions(rules: any) {
  const prompt = `Based on these audience rules, generate exactly 3 highly engaging SMS marketing messages. 
  Return ONLY a raw JSON array of 3 strings. Example format: ["Message 1", "Message 2", "Message 3"]
  Rules: ${JSON.stringify(rules)}`;
  
  const data = await callGemini(prompt, true);

  if (Array.isArray(data)) return data;
  if (data && data.messages && Array.isArray(data.messages)) return data.messages;
  if (data && data.suggestions && Array.isArray(data.suggestions)) return data.suggestions;

  // Ultimate fallback so the UI never crashes
  return ["Don't miss our latest sale!", "Exclusive VIP offer inside!", "Thank you for being a great customer!"];
}
// 4. Auto Tag
export async function autoTagCampaign(rules: any, message: string) {
  const prompt = `Analyze this marketing message. Return a single 1-word tag (e.g., 'Retention', 'VIP', 'Sale'). Return ONLY the word, no quotes. Message: ${message}`;
  return callGemini(prompt, false);
}

// 5. Generate Message Content
export async function generateMessageContent(segment: any) {
  const prompt = `Generate a single short SMS marketing message for this audience segment. Return ONLY the message text. Segment: ${JSON.stringify(segment)}`;
  return callGemini(prompt, false);
}

export async function summarizeCampaignPerformance(campaign: {
  name: string;
  audienceSize: number;
  sent: number;
  failed: number;
}) {
  const successRate = campaign.audienceSize > 0
    ? ((campaign.sent / campaign.audienceSize) * 100).toFixed(1)
    : '0';
  const prompt = `You are a CRM analyst. Write a 2-3 sentence performance summary for this campaign.
Campaign: "${campaign.name}"
Audience: ${campaign.audienceSize} customers
Sent: ${campaign.sent}, Failed: ${campaign.failed}, Success Rate: ${successRate}%
Return ONLY the summary text, no headers or bullet points.`;
  return callGemini(prompt, false);
}