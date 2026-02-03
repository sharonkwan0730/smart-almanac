import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';
const getCacheKey = (date: string) => `almanac_cache_v8_${date}`;

// 核心 API 呼叫：修正模型名稱與端點
async function callGeminiAPI(prompt: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n請以純 JSON 格式回傳，不要包含 Markdown 區塊。" }] }],
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
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.warn("Cache read error"); }
    }
  }

  try {
    const realData = await fetchRealAlmanac(dateStr);
    const tibetanData = await convertToTibetanCalendar(dateStr);
    const prompt = `分析日期 ${dateStr}，農曆為 ${realData.lunarDate}。請提供分析 JSON。`;
    const aiData = await callGeminiAPI(prompt);

    const result: AlmanacData = {
      solarDate: dateStr,
      lunarDate: realData.lunarDate || '載入中',
      solarTerm: realData.solarTerm || '',
      tibetanData: {
        ...tibetanData,
        analysis: aiData.analysis || '',
        dharmaAdvice: aiData.dharmaAdvice || '',
        traditionalActivities: {
          haircut: getHaircutAdvice(String(tibetanData?.day || "")),
          windHorse: getWindHorseAdvice(String(tibetanData?.day || "")),
          other: []
        }
      },
      stemBranch: `${realData.stemBranch?.year || ''}`,
      zodiac: realData.zodiac || '',
      auspicious: realData.suitable || [],
      inauspicious: realData.unsuitable || [],
      clashZodiac: realData.clash || '',
      spiritDirections: realData.directions || { joy: '', wealth: '', fortune: '' },
      fetalSpirit: realData.fetalGod || '',
      luckySpirits: realData.luckyGods || [],
      unluckySpirits: realData.unluckyGods || [],
      pengZuTaboo: realData.pengzu || '',
      dailyAdvice: aiData.dailyAdvice || '',
      hourlyLuck: []
    } as any;

    localStorage.setItem(getCacheKey(dateStr), JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("重大錯誤，強制回傳預設值:", error);
    return createSafeDefaultData(dateStr);
  }
}

export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  try {
    return await callGeminiAPI(`擇日: ${event} ${month}`);
  } catch {
    return [];
  }
}

export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  return await callGeminiAPI(`生肖 ${zodiac} 運勢 ${dateStr}`);
}

function createSafeDefaultData(date: string): AlmanacData {
  return {
    solarDate: date,
    lunarDate: '載入失敗',
    solarTerm: '',
    tibetanData: {
      date: '', yearName: '', weekday: '', constellation: '', yoga: '',
      analysis: '系統忙碌中，請重新整理頁面。',
      dharmaAdvice: '建議持咒修持。',
      traditionalActivities: { 
        haircut: '請參考農民曆', 
        windHorse: '請參考農民曆', 
        other: [] 
      }
    },
    stemBranch: '', zodiac: '', auspicious: [], inauspicious: [], hourlyLuck: []
  } as any;
}

async function generateFullAlmanac(date: string) { return createSafeDefaultData(date); }
async function generateWithAI(real: any, date: string) { return createSafeDefaultData(date); }
