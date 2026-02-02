// services/geminiService.ts
import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';
const getCacheKey = (date: string) => `almanac_cache_v8_${date}`;

async function callGeminiAPI(prompt: string): Promise<any> {
  // 💡 關鍵修正：移除 -latest，v1beta 正確路徑為 gemini-1.5-flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n回傳 JSON。" }] }],
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
    if (cached) try { return JSON.parse(cached); } catch (e) { }
  }

  try {
    const realData = await fetchRealAlmanac(dateStr);
    const tibetanData = await convertToTibetanCalendar(dateStr);
    const prompt = `分析日期 ${dateStr} 農民曆與藏曆。`;
    const aiData = await callGeminiAPI(prompt);
    
    const result: AlmanacData = {
      solarDate: dateStr,
      lunarDate: realData.lunarDate,
      stemBranch: `${realData.stemBranch.year}`,
      zodiac: realData.zodiac,
      auspicious: realData.suitable,
      inauspicious: realData.unsuitable,
      tibetanData: { ...tibetanData, analysis: aiData.analysis, dharmaAdvice: aiData.dharmaAdvice, traditionalActivities: { haircut: getHaircutAdvice(tibetanData.day), windHorse: getWindHorseAdvice(tibetanData.day), other: [] } },
      dailyAdvice: aiData.dailyAdvice || '',
      hourlyLuck: []
    } as any;

    localStorage.setItem(getCacheKey(dateStr), JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("Critical Failure:", error);
    // 💡 終極解鎖：如果出錯，立刻回傳預設值，這會讓 App.tsx 關閉 Loading 畫面
    return { solarDate: dateStr, lunarDate: '讀取失敗', dailyAdvice: '請檢查網路後重新整理', auspicious: [], inauspicious: [], hourlyLuck: [], tibetanData: {} } as any;
  }
}

// 補齊導出，避免 App.tsx 編譯錯誤
export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  try { return await callGeminiAPI(`擇日: ${event} ${month}`); } catch { return []; }
}

export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  try { return await callGeminiAPI(`運勢: ${zodiac} ${dateStr}`); } catch { throw new Error('運勢讀取失敗'); }
}
