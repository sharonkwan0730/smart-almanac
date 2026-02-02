// services/geminiService.ts
import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';
const getCacheKey = (date: string) => `almanac_cache_v7_${date}`;

// 核心 API 呼叫：解決 404 與 400 錯誤
async function callGeminiAPI(prompt: string): Promise<any> {
  // 💡 修正：移除 -latest 名稱，並使用 v1beta 以確保 JSON 解析穩定
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n請以純 JSON 格式回傳，不要包含 Markdown 區塊。" }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });
  if (!response.ok) throw new Error(`AI Error: ${response.status}`);
  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function getAlmanacForDate(dateStr: string, forceRefresh: boolean = false): Promise<AlmanacData> {
  if (!forceRefresh) {
    const cached = localStorage.getItem(getCacheKey(dateStr));
    if (cached) try { return JSON.parse(cached); } catch (e) { console.warn(e); }
  }

  let realData: RealAlmanacData;
  try { realData = await fetchRealAlmanac(dateStr); } catch (e) { return await generateFullAlmanac(dateStr); }

  let tibetanData: TibetanCalendarData;
  try { tibetanData = await convertToTibetanCalendar(dateStr); } catch (e) { return await generateWithAI(realData, dateStr); }

  const prompt = `分析 ${dateStr} 農民曆 ${realData.lunarDate} 與藏曆指引。回傳 JSON 含 analysis, dharmaAdvice, dailyAdvice。`;
  try {
    const aiData = await callGeminiAPI(prompt);
    const result: AlmanacData = {
      solarDate: dateStr, lunarDate: realData.lunarDate, solarTerm: realData.solarTerm,
      tibetanData: { ...tibetanData, yearName: tibetanData.year, analysis: aiData.analysis || '', dharmaAdvice: aiData.dharmaAdvice || '', meritMultiplier: tibetanData.merit, traditionalActivities: { haircut: getHaircutAdvice(tibetanData.day), windHorse: getWindHorseAdvice(tibetanData.day), other: [] } },
      stemBranch: `${realData.stemBranch.year} ${realData.stemBranch.month} ${realData.stemBranch.day}`, zodiac: realData.zodiac, fiveElements: '', auspicious: realData.suitable, inauspicious: realData.unsuitable, clashZodiac: realData.clash, spiritDirections: realData.directions, fetalSpirit: realData.fetalGod, luckySpirits: realData.luckyGods, unluckySpirits: realData.unluckyGods, pengZuTaboo: realData.pengzu, dailyAdvice: aiData.dailyAdvice || '',
      hourlyLuck: realData.hourlyLuck.map(h => ({ hour: h.hour, period: h.time, status: realData.luckyHours.includes(h.hour) ? '吉' : '凶', description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜' }))
    };
    localStorage.setItem(getCacheKey(dateStr), JSON.stringify(result));
    return result;
  } catch (e) { return convertRealToAlmanac(realData, dateStr, tibetanData); }
}

export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  return await callGeminiAPI(`在 ${month} 找 5 個適合 ${event} 的吉日。`);
}

export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  return await callGeminiAPI(`提供生肖 ${zodiac} 在 ${dateStr} 的運勢。`);
}

async function generateFullAlmanac(dateStr: string): Promise<AlmanacData> {
  return await callGeminiAPI(`生成 ${dateStr} 完整曆法 JSON。`);
}

async function generateWithAI(realData: RealAlmanacData, dateStr: string): Promise<AlmanacData> {
  const aiData = await callGeminiAPI(`生成 ${dateStr} 藏曆。`);
  return { ...convertRealToAlmanac(realData, dateStr), tibetanData: aiData.tibetanData };
}

function combinRealData(realData: RealAlmanacData, tibetanData: TibetanCalendarData, dateStr: string): AlmanacData {
  return convertRealToAlmanac(realData, dateStr, tibetanData);
}

function convertRealToAlmanac(real: RealAlmanacData, date: string, tibetan?: TibetanCalendarData): AlmanacData {
  return {
    solarDate: date, lunarDate: real.lunarDate, solarTerm: real.solarTerm,
    tibetanData: { date: tibetan?.date || '', yearName: tibetan?.year || '', weekday: tibetan?.weekday || '', constellation: tibetan?.constellation || '', yoga: tibetan?.yoga || '', analysis: '', auspicious: [], inauspicious: [], dharmaAdvice: '', meritMultiplier: '1倍', traditionalActivities: { haircut: '', windHorse: '', other: [] } },
    stemBranch: `${real.stemBranch.year} ${real.stemBranch.month} ${real.stemBranch.day}`, zodiac: real.zodiac, fiveElements: '', auspicious: real.suitable, inauspicious: real.unsuitable, clashZodiac: real.clash, spiritDirections: real.directions, fetalSpirit: real.fetalGod, luckySpirits: real.luckyGods, unluckySpirits: real.unluckyGods, pengZuTaboo: real.pengzu, dailyAdvice: '',
    hourlyLuck: real.hourlyLuck.map(h => ({ hour: h.hour, period: h.time, status: real.luckyHours.includes(h.hour) ? '吉' : '凶', description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜' }))
  };
}
