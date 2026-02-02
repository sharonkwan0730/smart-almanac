// services/geminiService.ts
import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';

async function callGeminiAPI(prompt: string): Promise<any> {
  // 💡 修正：v1beta 正確模型名為 gemini-1.5-flash (不加 -latest)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n請以純 JSON 格式回傳，不要包含 Markdown 區塊。" }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });

  if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function getAlmanacForDate(dateStr: string, forceRefresh: boolean = false): Promise<AlmanacData> {
  try {
    const realData = await fetchRealAlmanac(dateStr);
    const tibetanData = await convertToTibetanCalendar(dateStr);
    const aiData = await callGeminiAPI(`分析日期 ${dateStr}，農曆為 ${realData.lunarDate}。`);

    const result: AlmanacData = {
      solarDate: dateStr,
      lunarDate: realData.lunarDate,
      solarTerm: realData.solarTerm || '',
      tibetanData: {
        ...tibetanData,
        analysis: aiData.analysis || '',
        dharmaAdvice: aiData.dharmaAdvice || '',
        traditionalActivities: {
          haircut: getHaircutAdvice(tibetanData.day),
          windHorse: getWindHorseAdvice(tibetanData.day),
          other: []
        }
      },
      stemBranch: `${realData.stemBranch.year} ${realData.stemBranch.month} ${realData.stemBranch.day}`,
      zodiac: realData.zodiac,
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
        hour: h.hour,
        period: h.time,
        status: '平',
        description: '宜持咒'
      }))
    };
    return result;
  } catch (error) {
    console.error("Critical error, returning safe data:", error);
    // 💡 修正：即使失敗也回傳完整結構，避免畫面 "Cannot read properties of undefined (reading 'haircut')" 崩潰
    return createSafeDefaultData(dateStr);
  }
}

export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  try {
    return await callGeminiAPI(`在 ${month} 找出適合 ${event} 的 5 個吉日。`);
  } catch {
    return [];
  }
}

export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  return await callGeminiAPI(`生肖 ${zodiac} 在 ${dateStr} 的運勢。`);
}

// 輔助函式：當一切都失敗時，回傳不讓畫面當機的資料
function createSafeDefaultData(date: string): AlmanacData {
  return {
    solarDate: date,
    lunarDate: '資料讀取中',
    tibetanData: {
      date: '', yearName: '', weekday: '', constellation: '', yoga: '',
      analysis: '系統連線繁忙，請重新整理頁面。',
      dharmaAdvice: '建議持咒修持。',
      traditionalActivities: { haircut: '請參考農民曆', windHorse: '請參考農民曆', other: [] }
    },
    stemBranch: '', zodiac: '', auspicious: [], inauspicious: [], hourlyLuck: []
  } as any;
}

// 內部備用函式
async function generateFullAlmanac(date: string) { return createSafeDefaultData(date); }
async function generateWithAI(real: any, date: string) { return createSafeDefaultData(date); }
