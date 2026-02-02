import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

// API Key (建議生產環境使用 import.meta.env.VITE_GEMINI_API_KEY)
const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';
const getCacheKey = (date: string) => `almanac_cache_v7_${date}`;

/**
 * 核心修正：呼叫 Gemini API
 * 解決 400 錯誤 (Unknown name "responseMimeType")
 */
async function callGeminiAPI(prompt: string, _responseSchema: any): Promise<any> {
  // 注意：我們將 v1 改為 v1beta，因為 v1 有時不支援 responseMimeType
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + "\n請務必以純 JSON 格式回傳，不要包含 Markdown 代碼區塊 (```json)。" }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        // 如果還是報 400 錯誤，建議將下面兩行註解掉，靠 Prompt 強制 JSON
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error:', response.status, errorText);
    throw new Error(`AI 服務錯誤: ${response.status}`);
  }

  const data = await response.json();
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('AI 回應格式異常');
  }
  
  let text = data.candidates[0].content.parts[0].text;
  
  // 增加防錯處理：移除 AI 可能夾帶的 Markdown 標籤
  const cleanedText = text.replace(/```json|```/g, "").trim();
  
  try {
    return JSON.parse(cleanedText);
  } catch (e) {
    console.error("JSON 解析失敗，原始文字:", text);
    throw new Error("AI 回傳的資料不是有效的 JSON 格式");
  }
}

export async function getAlmanacForDate(dateStr: string, forceRefresh: boolean = false): Promise<AlmanacData> {
  if (!forceRefresh) {
    const cached = localStorage.getItem(getCacheKey(dateStr));
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.warn("Cache error", e); }
    }
  }

  // 第一步：爬取真實農民曆
  let realData: RealAlmanacData;
  try {
    console.log('正在爬取真實農民曆資料...');
    realData = await fetchRealAlmanac(dateStr);
    console.log('✅ 真實農民曆資料取得成功', realData);
  } catch (error) {
    console.error('❌ 爬取農民曆失敗，使用 AI 生成:', error);
    return await generateFullAlmanac(dateStr);
  }

  // 第二步：取得真實藏曆
  let tibetanData: TibetanCalendarData;
  try {
    console.log('正在轉換藏曆...');
    tibetanData = await convertToTibetanCalendar(dateStr);
    console.log('✅ 藏曆轉換成功', tibetanData);
  } catch (error) {
    console.error('❌ 藏曆轉換失敗，使用 AI 生成:', error);
    return await generateWithAI(realData, dateStr);
  }

  // 第三步：用 AI 生成深度解析
  const prompt = `請作為精通藏傳佛教的導師，為 ${dateStr} 提供修法指引。
已知真實資料：
【農民曆】
- 農曆：${realData.lunarDate}
- 干支：${realData.stemBranch.year} ${realData.stemBranch.month} ${realData.stemBranch.day}
- 宜：${realData.suitable.join('、')}
- 忌：${realData.unsuitable.join('、')}
【藏曆】
- 日期：${tibetanData.date}
- 星宿：${tibetanData.constellation}
- 瑜伽：${tibetanData.yoga}
請提供：analysis (150字解析), dharmaAdvice (修法建議), dailyAdvice (每日建言)。使用繁體中文。`;

  try {
    const aiData = await callGeminiAPI(prompt, {});
    
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
        hour: h.hour,
        period: h.time,
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

// 組合真實資料（不用 AI）
function combinRealData(realData: RealAlmanacData, tibetanData: TibetanCalendarData, dateStr: string): AlmanacData {
  return {
    solarDate: dateStr,
    lunarDate: realData.lunarDate,
    solarTerm: realData.solarTerm,
    tibetanData: {
      date: tibetanData.date,
      yearName: tibetanData.year,
      weekday: tibetanData.weekday,
      constellation: tibetanData.constellation,
      yoga: tibetanData.yoga,
      analysis: tibetanData.buddhaDay || '宜保持正念修持。',
      auspicious: tibetanData.auspicious,
      inauspicious: tibetanData.inauspicious,
      specialDay: tibetanData.specialDay,
      dharmaAdvice: '建議日常持咒、禮佛、行善積德。',
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
    dailyAdvice: `農民曆宜${realData.suitable.slice(0, 3).join('、')}`,
    hourlyLuck: realData.hourlyLuck.map(h => ({
      hour: h.hour,
      period: h.time,
      status: realData.luckyHours.includes(h.hour) ? '吉' : '凶',
      description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜'
    }))
  };
}

// ...其餘備用 AI 生成函式 (generateWithAI, generateFullAlmanac, findLuckyDates, getZodiacFortune) 
// 請確保內部呼叫 callGeminiAPI 的地方都套用了上述的修正。
