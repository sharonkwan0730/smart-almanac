import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

// API Key (如果 Vercel 上有環境變數，建議改用 import.meta.env.VITE_GEMINI_API_KEY)
const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';
const getCacheKey = (date: string) => `almanac_cache_v7_${date}`;

/**
 * 核心 API 呼叫：解決 400 錯誤
 */
async function callGeminiAPI(prompt: string): Promise<any> {
  // 改用 v1beta 以提高相容性
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n\n請務必回傳純 JSON 格式，不要包含 Markdown 區塊 (```json 字樣)。" }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
        // ❌ 移除 responseMimeType，這在某些環境會造成報錯
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error:', response.status, errorText);
    throw new Error(`AI 服務錯誤: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  const cleanedText = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleanedText);
}

/**
 * 主功能：取得指定日期的農民曆與藏曆
 */
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

  const prompt = `為 ${dateStr} 提供修法指引。
農民曆：農曆 ${realData.lunarDate}, 干支 ${realData.stemBranch.year} ${realData.stemBranch.month} ${realData.stemBranch.day}
藏曆：${tibetanData.date}, 星宿 ${tibetanData.constellation}
請提供 JSON：analysis (200字解析), dharmaAdvice (修法建議), dailyAdvice (建言)。繁體中文。`;

  try {
    const aiData = await callGeminiAPI(prompt);
    const result: AlmanacData = {
      solarDate: dateStr,
      lunarDate: realData.lunarDate,
      solarTerm: realData.solarTerm,
      tibetanData: {
        ...tibetanData,
        yearName: tibetanData.year,
        analysis: aiData.analysis || '今日宜依照農民曆安排活動',
        dharmaAdvice: aiData.dharmaAdvice || '建議日常持咒修持',
        meritMultiplier: tibetanData.merit,
        traditionalActivities: {
          haircut: getHaircutAdvice(tibetanData.day),
          windHorse: getWindHorseAdvice(tibetanData.day),
          other: tibetanData.buddhaDay ? ['供養', '持咒'] : []
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

// 補回 App.tsx 需要的 Export 函式
export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  const prompt = `在 ${month} 中找出適合「${event}」的5個吉日。回傳 JSON 陣列，物件含 date, lunarDate, reason, rating。`;
  return await callGeminiAPI(prompt);
}

export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  const prompt = `生肖「${zodiac}」在「${dateStr}」的運勢。回傳 JSON 含 daily(overall, wealth, love, career, score), monthly, elementAnalysis。`;
  return await callGeminiAPI(prompt);
}

// 內部輔助函式
async function generateFullAlmanac(dateStr: string): Promise<AlmanacData> {
  const prompt = `請為 ${dateStr} 提供完整的農民曆與藏曆資料 JSON。使用繁體中文。`;
  return await callGeminiAPI(prompt);
}

async function generateWithAI(realData: RealAlmanacData, dateStr: string): Promise<AlmanacData> {
  const prompt = `為 ${dateStr} 提供藏曆資料 JSON。已知農民曆為 ${realData.lunarDate}。`;
  const aiData = await callGeminiAPI(prompt);
  return { ...convertRealToAlmanac(realData, dateStr), tibetanData: aiData.tibetanData };
}

function combinRealData(realData: RealAlmanacData, tibetanData: TibetanCalendarData, dateStr: string): AlmanacData {
  return convertRealToAlmanac(realData, dateStr);
}

function convertRealToAlmanac(realData: RealAlmanacData, dateStr: string): AlmanacData {
  return {
    solarDate: dateStr,
    lunarDate: realData.lunarDate,
    solarTerm: realData.solarTerm,
    tibetanData: {
        date: '', yearName: '', weekday: '', constellation: '', yoga: '', analysis: '請參考農民曆',
        auspicious: [], inauspicious: [], dharmaAdvice: '建議持咒', meritMultiplier: '1倍',
        traditionalActivities: { haircut: '', windHorse: '', other: [] }
    },
    stemBranch: `${realData.stemBranch.year} ${realData.stemBranch.month} ${realData.stemBranch.day}`,
    zodiac: realData.zodiac, fiveElements: '',
    auspicious: realData.suitable, inauspicious: realData.unsuitable,
    clashZodiac: realData.clash, spiritDirections: realData.directions,
    fetalSpirit: realData.fetalGod, luckySpirits: realData.luckyGods,
    unluckySpirits: realData.unluckyGods, pengZuTaboo: realData.pengzu, dailyAdvice: '',
    hourlyLuck: realData.hourlyLuck.map(h => ({
      hour: h.hour, period: h.time,
      status: realData.luckyHours.includes(h.hour) ? '吉' : '凶',
      description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜'
