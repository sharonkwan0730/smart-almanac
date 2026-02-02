// services/geminiService.ts
import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice } from "./tibetanCalendar";

const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';

async function callGeminiAPI(prompt: string): Promise<any> {
  // 💡 修正 1：移除 -latest
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n回傳純 JSON。" }] }],
      generationConfig: { temperature: 0.7 }
    })
  });
  if (!response.ok) throw new Error('AI Error');
  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function getAlmanacForDate(dateStr: string): Promise<AlmanacData> {
  try {
    const realData = await fetchRealAlmanac(dateStr);
    const tibetanData = await convertToTibetanCalendar(dateStr);
    const aiData = await callGeminiAPI(`分析日期 ${dateStr}。`);

    return {
      solarDate: dateStr,
      lunarDate: realData.lunarDate,
      tibetanData: {
        ...tibetanData,
        analysis: aiData.analysis || '',
        traditionalActivities: {
          haircut: getHaircutAdvice(tibetanData?.day || 0),
          windHorse: getWindHorseAdvice(tibetanData?.day || 0),
          other: []
        }
      },
      stemBranch: `${realData.stemBranch?.year || ''}`,
      zodiac: realData.zodiac || '',
      auspicious: realData.suitable || [],
      inauspicious: realData.unsuitable || [],
      dailyAdvice: aiData.dailyAdvice || '',
      hourlyLuck: []
    } as any;
  } catch (error) {
    console.error("強制恢復 UI:", error);
    // 💡 修正 2：補齊 traditionalActivities，防止畫面死鎖
    return createSafeDefaultData(dateStr);
  }
}

function createSafeDefaultData(date: string): AlmanacData {
  return {
    solarDate: date,
    lunarDate: '載入中',
    tibetanData: {
      analysis: '系統繁忙，請重新整理。',
      traditionalActivities: { haircut: '請參考宜忌', windHorse: '請參考宜忌', other: [] }
    },
    auspicious: [], inauspicious: [], hourlyLuck: []
  } as any;
}

export async function findLuckyDates(e: EventType, m: string): Promise<DateRecommendation[]> {
  try { return await callGeminiAPI(`擇日: ${e} ${m}`); } catch { return []; }
}

export async function getZodiacFortune(z: ZodiacType, d: string): Promise<ZodiacFortune> {
  return await callGeminiAPI(`運勢: ${z} ${d}`);
}
