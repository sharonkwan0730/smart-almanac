import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';
const getCacheKey = (date: string) => `almanac_cache_v7_${date}`;

/**
 * 核心 API 呼叫：移除 responseMimeType 避免 400 錯誤，改用 v1beta
 */
async function callGeminiAPI(prompt: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n\n請務必以純 JSON 格式回傳，不要包含 Markdown 區塊 (不要出現 ```json 字樣)。" }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
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

  const prompt = `針對日期 ${dateStr}，農民曆為 ${realData.lunarDate}。請提供深度解析 (analysis)、修行建議 (dharmaAdvice)、每日建言 (dailyAdvice)。使用繁體中文，JSON 格式。`;

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

/**
 * 擇日功能：解決 App.tsx 編譯報錯
 */
export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  const prompt = `在 ${month} 中尋找適合 ${event} 的 5 個吉日。回傳 JSON 陣列含 date, lunarDate, reason, rating。`;
  return await callGeminiAPI(prompt);
}

/**
 * 生肖運勢功能：解決 App.tsx 編譯報錯
 */
export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  const prompt = `生肖 ${zodiac} 在 ${dateStr} 的運勢。回傳 JSON 含 daily: {overall, wealth, love, career, score}, monthly, elementAnalysis。`;
  return await callGeminiAPI(prompt);
}

/**
 * 內部輔助函式：備用生成
 */
async function generateFullAlmanac(dateStr: string): Promise<AlmanacData> {
  const prompt = `生成 ${dateStr} 的完整曆法資料。`;
  const aiData = await callGeminiAPI(prompt);
  return aiData;
}

async function generateWithAI(realData: RealAlmanacData, dateStr: string): Promise<AlmanacData> {
  const prompt = `基於農民曆 ${realData.lunarDate} 生成 ${dateStr} 的藏曆 JSON。`;
  const aiData = await callGeminiAPI(prompt);
  const base = convertRealToAlmanac(realData, dateStr);
  return { ...base, tibetanData: { ...base.tibetanData, ...aiData.tibetanData } };
}

function combinRealData(realData: RealAlmanacData, tibetanData: TibetanCalendarData, dateStr: string): AlmanacData {
  const base = convertRealToAlmanac(realData, dateStr);
  return { ...base, tibetanData: { ...base.tibetanData, ...tibetanData, yearName: tibetanData.year } };
}

function convertRealToAlmanac(real: RealAlmanacData, date: string): AlmanacData {
  return {
    solarDate: date,
    lunarDate: real.lunarDate,
    solarTerm: real.solarTerm,
    tibetanData: {
      date: '', yearName: '', weekday: '', constellation: '', yoga: '', analysis: '參考農民曆',
      auspicious: [], inauspicious: [], dharmaAdvice: '日常修持', meritMultiplier: '1倍',
      traditionalActivities: { haircut: '', windHorse: '', other: [] }
    },
    stemBranch: `${real.stemBranch.year} ${real.stemBranch.month} ${real.stemBranch.day}`,
    zodiac: real.zodiac,
    fiveElements: '',
    auspicious: real.suitable,
    inauspicious: real.unsuitable,
    clashZodiac: real.clash,
    spiritDirections: real.directions,
    fetalSpirit: real.fetalGod,
    luckySpirits: real.luckyGods,
    unluckySpirits: real.unluckyGods,
    pengZuTaboo: real.pengzu,
    dailyAdvice: '',
    hourlyLuck: real.hourlyLuck.map(h => ({
      hour: h.hour, period: h.time,
      status: real.luckyHours.includes(h.hour) ? '吉' : '凶',
      description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜'
    }))
  };
}
