// services/geminiService.ts
import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';
const getCacheKey = (date: string) => `almanac_cache_v7_${date}`;

async function callGeminiAPI(prompt: string): Promise<any> {
  // 💡 核心修正：將模型名稱改為 gemini-1.5-flash，v1beta 才能找到它
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n\n請以純 JSON 格式回傳。" }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });

  if (!response.ok) throw new Error(`AI API 錯誤: ${response.status}`);
  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function getAlmanacForDate(dateStr: string, forceRefresh: boolean = false): Promise<AlmanacData> {
  if (!forceRefresh) {
    const cached = localStorage.getItem(getCacheKey(dateStr));
    if (cached) try { return JSON.parse(cached); } catch (e) { console.warn(e); }
  }

  try {
    const realData = await fetchRealAlmanac(dateStr);
    const tibetanData = await convertToTibetanCalendar(dateStr);
    const prompt = `分析 ${dateStr} 農民曆 ${realData.lunarDate}。提供 analysis, dharmaAdvice, dailyAdvice 的 JSON。`;
    const aiData = await callGeminiAPI(prompt);
    
    const result: AlmanacData = {
      solarDate: dateStr, lunarDate: realData.lunarDate, solarTerm: realData.solarTerm,
      tibetanData: { ...tibetanData, yearName: tibetanData.year, analysis: aiData.analysis || '', dharmaAdvice: aiData.dharmaAdvice || '', meritMultiplier: tibetanData.merit, traditionalActivities: { haircut: getHaircutAdvice(tibetanData.day), windHorse: getWindHorseAdvice(tibetanData.day), other: [] } },
      stemBranch: `${realData.stemBranch.year} ${realData.stemBranch.month} ${realData.stemBranch.day}`, zodiac: realData.zodiac, fiveElements: '', auspicious: realData.suitable, inauspicious: realData.unsuitable, clashZodiac: realData.clash, spiritDirections: realData.directions, fetalSpirit: realData.fetalGod, luckySpirits: realData.luckyGods, unluckySpirits: realData.unluckyGods, pengZuTaboo: realData.pengzu, dailyAdvice: aiData.dailyAdvice || '',
      hourlyLuck: realData.hourlyLuck.map(h => ({ hour: h.hour, period: h.time, status: realData.luckyHours.includes(h.hour) ? '吉' : '凶', description: h.suitable.slice(0, 3).join('、') || '諸事不宜' }))
    };
    localStorage.setItem(getCacheKey(dateStr), JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("整體流程錯誤:", error);
    // 💡 防死當機制：如果出錯，返回一個空的結構，讓 UI 可以顯示出來而不卡死
    return { solarDate: dateStr, lunarDate: '載入失敗', stemBranch: '', zodiac: '', auspicious: [], inauspicious: [], dailyAdvice: '系統繁忙中，請重新整理頁面。', hourlyLuck: [] } as any;
  }
}

// 補齊 App.tsx 需要的所有 Export
export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  try { return await callGeminiAPI(`在 ${month} 中找 5 個適合 ${event} 的吉日。`); } 
  catch (e) { return []; }
}

export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  try { return await callGeminiAPI(`提供生肖 ${zodiac} 在 ${dateStr} 的運勢。`); }
  catch (e) { throw e; }
}

// 內部輔助函式定義
async function generateFullAlmanac(dateStr: string): Promise<AlmanacData> {
  return await callGeminiAPI(`生成 ${dateStr} 的完整曆法資料。`);
}

async function generateWithAI(realData: RealAlmanacData, dateStr: string): Promise<AlmanacData> {
  return await callGeminiAPI(`基於 ${realData.lunarDate} 生成 ${dateStr} 藏曆。`);
}
