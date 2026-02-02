import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';
const getCacheKey = (date: string) => `almanac_cache_v7_${date}`;

// 核心 API 呼叫函式
async function callGeminiAPI(prompt: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n\n請以純 JSON 格式回傳，不要包含 Markdown 區塊。" }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });

  if (!response.ok) throw new Error(`AI 服務錯誤: ${response.status}`);

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// 主導功能
export async function getAlmanacForDate(dateStr: string, forceRefresh: boolean = false): Promise<AlmanacData> {
  if (!forceRefresh) {
    const cached = localStorage.getItem(getCacheKey(dateStr));
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.warn("Cache error", e); }
    }
  }

  let realData: RealAlmanacData;
  try {
    realData = await fetchRealAlmanac(dateStr);
  } catch (error) {
    return await generateFullAlmanac(dateStr);
  }

  let tibetanData: TibetanCalendarData;
  try {
    tibetanData = await convertToTibetanCalendar(dateStr);
  } catch (error) {
    return await generateWithAI(realData, dateStr);
  }

  const prompt = `針對 ${dateStr} 提供深度解析 (analysis)、修行建議 (dharmaAdvice)、每日建言 (dailyAdvice)。已知農民曆 ${realData.lunarDate}。`;

  try {
    const aiData = await callGeminiAPI(prompt);
    const result: AlmanacData = {
      solarDate: dateStr,
      lunarDate: realData.lunarDate,
      solarTerm: realData.solarTerm,
      tibetanData: {
        ...tibetanData,
        yearName: tibetanData.year,
        analysis: aiData.analysis || '',
        dharmaAdvice: aiData.dharmaAdvice || '',
        meritMultiplier: tibetanData.merit,
        traditionalActivities: {
          haircut: getHaircutAdvice(tibetanData.day),
          windHorse: getWindHorseAdvice(tibetanData.day),
          other: []
        }
      },
      stemBranch: `${realData.stemBranch.year} ${realData.stemBranch.month} ${realData.stemBranch.day}`,
      zodiac: realData.zodiac,
      fiveElements: '',
      auspicious: realData.suitable,
      inauspicious: realData.unsuitable,
      clashZodiac: realData.clash,
      spiritDirections: realData.directions,
      fetalSpirit: realData.fetalGod,
      luckySpirits: realData.luckyGods,
      unluckySpirits: realData.unluckyGods,
      pengZuTaboo: realData.pengzu,
      dailyAdvice: aiData.dailyAdvice || '',
      hourlyLuck: realData.hourlyLuck.map(h => ({
        hour: h.hour, period: h.time,
        status: realData.luckyHours.includes(h.hour) ? '吉' : '凶',
        description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜'
      }))
    };
    localStorage.setItem(getCacheKey(dateStr), JSON.stringify(result));
    return result;
  } catch (error) {
    return combinRealData(realData, tibetanData, dateStr);
  }
}

// ✅ 補回 App.tsx 需要的 Export 函式
export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  const prompt = `在 ${month} 中尋找適合 ${event} 的 5 個吉日，以 JSON 陣列回傳物件 (date, lunarDate, reason, rating)。`;
  return await callGeminiAPI(prompt);
}

export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  const prompt = `提供生肖 ${zodiac} 在 ${dateStr} 的運勢 JSON (daily: {overall, wealth, love, career, score}, monthly, elementAnalysis)。`;
  return await callGeminiAPI(prompt);
}

// 內部輔助函式
async function generateFullAlmanac(dateStr: string): Promise<AlmanacData> {
  const prompt = `生成 ${dateStr} 的完整農民曆與藏曆 JSON。`;
  return await callGeminiAPI(prompt);
}

async function generateWithAI(realData: RealAlmanacData, dateStr: string): Promise<AlmanacData> {
  const prompt = `基於農民曆 ${realData.lunarDate} 生成 ${dateStr} 的藏曆資料。`;
  const aiData = await callGeminiAPI(prompt);
  return { ...convertRealToAlmanac(realData, dateStr), tibetanData: aiData.tibetanData };
}

function combinRealData(realData: RealAlmanacData, tibetanData: TibetanCalendarData, dateStr: string): AlmanacData {
  const base = convertRealToAlmanac(realData, dateStr);
  return { ...base, tibetanData: { ...base.tibetanData, ...tibetanData, yearName: tib
