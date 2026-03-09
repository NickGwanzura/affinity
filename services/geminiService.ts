
import { GoogleGenAI } from "@google/genai";
import { LandedCostSummary } from "../types";

// Rate limiting for API calls
let lastCallTime = 0;
const MIN_CALL_INTERVAL = 2000; // 2 seconds between calls
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Request throttling
const throttle = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  
  if (timeSinceLastCall < MIN_CALL_INTERVAL) {
    const waitTime = MIN_CALL_INTERVAL - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCallTime = Date.now();
};

// Retry logic with exponential backoff
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries === 0) throw error;
    
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
    return retryWithBackoff(fn, retries - 1);
  }
};

// Sanitize data before sending to API
const sanitizeData = (data: LandedCostSummary[]): string => {
  if (!Array.isArray(data) || data.length === 0) {
    return 'No data available';
  }
  
  // Limit to top 10 vehicles to avoid token limits
  const limitedData = data.slice(0, 10).map(item => ({
    make_model: item.make_model,
    status: item.status,
    total_cost_usd: Math.round(item.total_landed_cost_usd),
    expenses_usd: Math.round(item.total_expenses_usd)
  }));
  
  return JSON.stringify(limitedData, null, 2);
};

export const getLogisticsInsights = async (data: LandedCostSummary[]): Promise<string> => {
  const startTime = Date.now();
  
  // Validation
  if (!data || !Array.isArray(data)) {
    return "⚠️ Unable to generate insights: Invalid data format";
  }
  
  if (data.length === 0) {
    return "📊 No fleet data available for analysis. Add vehicles to get AI-powered insights.";
  }

  // Check if API key is available
  if (!process.env.API_KEY) {
    return "⚠️ AI insights unavailable: Gemini API key not configured. Add GEMINI_API_KEY to your .env file to enable intelligent fleet analytics.";
  }

  try {
    // Apply throttling
    await throttle();
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const sanitizedData = sanitizeData(data);
    const prompt = `Analyze the following logistics data for Affinity Logistics and provide 3 key business insights regarding profitability and efficiency. Format the response as a bulleted list of short paragraphs. Be concise and actionable.
  
Data Summary:
Total Vehicles: ${data.length}
${sanitizedData}

Focus on: cost optimization, vehicle utilization, and profit margins.`;

    const response = await retryWithBackoff(async () => {
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return result.text;
    });
    
    return response;
    
  } catch (error: any) {
    // Provide meaningful fallback based on actual data
    const totalVehicles = data.length;
    const avgCost = Math.round(data.reduce((sum, v) => sum + v.total_landed_cost_usd, 0) / totalVehicles);
    const statusBreakdown = data.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return `📊 AI Fleet Analytics temporarily unavailable. Manual Summary:\n\n` +
           `• Total Fleet: ${totalVehicles} vehicles\n` +
           `• Average Landed Cost: $${avgCost.toLocaleString()}\n` +
           `• Status: ${Object.entries(statusBreakdown).map(([k, v]) => `${k}: ${v}`).join(', ')}\n\n` +
           `Contact support if AI insights remain unavailable.`;
  }
};
