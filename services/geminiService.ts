import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac, RealAlmanacData } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice, TibetanCalendarData } from "./tibetanCalendar";

// API Key
const GEMINI_API_KEY = 'AIzaSyA9knjiWHGGzoX2STx7qq-GRlbqHbbaGRw';
const getCacheKey = (date: string) => `almanac_cache_v7_${date}`;

// 呼叫 Gemini API
async function callGeminiAPI(prompt: string, responseSchema: any): Promise<any> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: responseSchema
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('API 配額已用盡，請稍後再試');
    } else if (response.status === 403) {
      throw new Error('API Key 無效');
    }
    
    throw new Error(`AI 服務錯誤: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0]) {
    throw new Error('AI 回應格式異常');
  }
  
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text);
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
- 生肖：${realData.zodiac}
- 宜：${realData.suitable.join('、')}
- 忌：${realData.unsuitable.join('、')}

【藏曆】
- 日期：${tibetanData.date}
- 星宿：${tibetanData.constellation}
- 瑜伽：${tibetanData.yoga}
- 佛日：${tibetanData.buddhaDay || '一般日'}

請提供：
1. 深度解析 (analysis)：150-200字，結合農民曆和藏曆，給予修行與生活建議
2. 修行建議 (dharmaAdvice)：具體推薦本日適合的修法（如：綠度母、藥師佛、煙供等）
3. 每日建言 (dailyAdvice)：簡短的生活指引

使用繁體中文，語氣溫和智慧。`;

  const responseSchema = {
    type: "object",
    properties: {
      analysis: { type: "string" },
      dharmaAdvice: { type: "string" },
      dailyAdvice: { type: "string" }
    }
  };

  try {
    const aiData = await callGeminiAPI(prompt, responseSchema);
    
    // 組合：真實農民曆 + 真實藏曆 + AI 深度解析
    const result: AlmanacData = {
      solarDate: dateStr,
      lunarDate: realData.lunarDate,
      solarTerm: realData.solarTerm,
      tibetanData: {
        date: tibetanData.date,
        yearName: tibetanData.year,
        weekday: tibetanData.weekday,
        constellation: tibetanData.constellation,
        yoga: tibetanData.yoga,
        analysis: aiData.analysis || tibetanData.buddhaDay || '今日宜依照農民曆宜忌安排活動',
        auspicious: tibetanData.auspicious,
        inauspicious: tibetanData.inauspicious,
        specialDay: tibetanData.specialDay,
        dharmaAdvice: aiData.dharmaAdvice || '建議依照藏曆進行日常修持',
        meritMultiplier: tibetanData.merit,
        traditionalActivities: {
          haircut: getHaircutAdvice(tibetanData.day),
          windHorse: getWindHorseAdvice(tibetanData.day),
          other: tibetanData.buddhaDay ? ['供養', '持咒', '放生'] : []
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
    console.error('AI 處理失敗，返回農民曆+藏曆資料:', error);
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
      analysis: tibetanData.buddhaDay 
        ? `今日為${tibetanData.buddhaDay}，${tibetanData.merit}。建議多行善事、供養三寶、持咒修法。`
        : '今日宜依照農民曆宜忌安排活動，保持正念修持。',
      auspicious: tibetanData.auspicious,
      inauspicious: tibetanData.inauspicious,
      specialDay: tibetanData.specialDay,
      dharmaAdvice: tibetanData.buddhaDay 
        ? '建議供養、持咒、放生、佈施等善行，功德倍增。'
        : '建議日常持咒、禮佛、行善積德。',
      meritMultiplier: tibetanData.merit,
      traditionalActivities: {
        haircut: getHaircutAdvice(tibetanData.day),
        windHorse: getWindHorseAdvice(tibetanData.day),
        other: tibetanData.buddhaDay ? ['供養', '持咒', '放生'] : []
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
    dailyAdvice: tibetanData.buddhaDay 
      ? `今日為${tibetanData.buddhaDay}，宜多行善事。農民曆宜${realData.suitable.slice(0, 3).join('、')}。`
      : `農民曆宜${realData.suitable.slice(0, 3).join('、')}，忌${realData.unsuitable.slice(0, 2).join('、')}。`,
    hourlyLuck: realData.hourlyLuck.map(h => ({
      hour: h.hour,
      period: h.time,
      status: realData.luckyHours.includes(h.hour) ? '吉' : '凶',
      description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜'
    }))
  };
}

// 使用 AI 生成藏曆（當真實轉換失敗時）
async function generateWithAI(realData: RealAlmanacData, dateStr: string): Promise<AlmanacData> {
  const prompt = `請為 ${dateStr} 提供藏曆與修法指引。

已知農民曆：
- 農曆：${realData.lunarDate}
- 干支：${realData.stemBranch.year} ${realData.stemBranch.month} ${realData.stemBranch.day}

請生成藏曆資料並提供修行建議。使用繁體中文。`;

  const responseSchema = {
    type: "object",
    properties: {
      tibetanData: {
        type: "object",
        properties: {
          date: { type: "string" },
          yearName: { type: "string" },
          weekday: { type: "string" },
          constellation: { type: "string" },
          yoga: { type: "string" },
          analysis: { type: "string" },
          auspicious: { type: "array", items: { type: "string" } },
          inauspicious: { type: "array", items: { type: "string" } },
          specialDay: { type: "string" },
          dharmaAdvice: { type: "string" },
          meritMultiplier: { type: "string" },
          traditionalActivities: {
            type: "object",
            properties: {
              haircut: { type: "string" },
              windHorse: { type: "string" },
              other: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      dailyAdvice: { type: "string" }
    }
  };

  try {
    const aiData = await callGeminiAPI(prompt, responseSchema);
    
    return {
      solarDate: dateStr,
      lunarDate: realData.lunarDate,
      solarTerm: realData.solarTerm,
      tibetanData: aiData.tibetanData,
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
      dailyAdvice: aiData.dailyAdvice,
      hourlyLuck: realData.hourlyLuck.map(h => ({
        hour: h.hour,
        period: h.time,
        status: realData.luckyHours.includes(h.hour) ? '吉' : '凶',
        description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜'
      }))
    };
  } catch (error) {
    return convertRealToAlmanac(realData, dateStr);
  }
}

// 完全用 AI 生成（備用）
async function generateFullAlmanac(dateStr: string): Promise<AlmanacData> {
  const prompt = `請為 ${dateStr} 提供完整的農民曆與藏曆資料。使用繁體中文。`;

  const responseSchema = {
    type: "object",
    properties: {
      solarDate: { type: "string" },
      lunarDate: { type: "string" },
      solarTerm: { type: "string" },
      tibetanData: {
        type: "object",
        properties: {
          date: { type: "string" },
          yearName: { type: "string" },
          weekday: { type: "string" },
          constellation: { type: "string" },
          yoga: { type: "string" },
          analysis: { type: "string" },
          auspicious: { type: "array", items: { type: "string" } },
          inauspicious: { type: "array", items: { type: "string" } },
          specialDay: { type: "string" },
          dharmaAdvice: { type: "string" },
          meritMultiplier: { type: "string" },
          traditionalActivities: {
            type: "object",
            properties: {
              haircut: { type: "string" },
              windHorse: { type: "string" },
              other: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      stemBranch: { type: "string" },
      zodiac: { type: "string" },
      fiveElements: { type: "string" },
      auspicious: { type: "array", items: { type: "string" } },
      inauspicious: { type: "array", items: { type: "string" } },
      clashZodiac: { type: "string" },
      spiritDirections: {
        type: "object",
        properties: {
          wealth: { type: "string" },
          joy: { type: "string" }
        }
      },
      fetalSpirit: { type: "string" },
      luckySpirits: { type: "array", items: { type: "string" } },
      unluckySpirits: { type: "array", items: { type: "string" } },
      pengZuTaboo: { type: "string" },
      dailyAdvice: { type: "string" },
      hourlyLuck: {
        type: "array",
        items: {
          type: "object",
          properties: {
            hour: { type: "string" },
            period: { type: "string" },
            status: { type: "string" },
            description: { type: "string" }
          }
        }
      }
    }
  };

  return await callGeminiAPI(prompt, responseSchema);
}

// 轉換真實資料為 AlmanacData
function convertRealToAlmanac(realData: RealAlmanacData, dateStr: string): AlmanacData {
  return {
    solarDate: dateStr,
    lunarDate: realData.lunarDate,
    solarTerm: realData.solarTerm,
    tibetanData: {
      date: '',
      yearName: '',
      weekday: '',
      constellation: '',
      yoga: '',
      analysis: '今日曆法資料來自傳統農民曆，請參考宜忌事項安排活動。',
      auspicious: [],
      inauspicious: [],
      dharmaAdvice: '建議依照農民曆宜忌進行修行與日常活動安排。',
      traditionalActivities: {
        haircut: '請參考農民曆宜忌',
        windHorse: '請參考農民曆宜忌',
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
    dailyAdvice: '請參考今日宜忌事項安排活動。',
    hourlyLuck: realData.hourlyLuck.map(h => ({
      hour: h.hour,
      period: h.time,
      status: realData.luckyHours.includes(h.hour) ? '吉' : '凶',
      description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜'
    }))
  };
}

export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  const prompt = `在 ${month} 中找出適合「${event}」的5個吉日。使用繁體中文回應。`;
  
  const responseSchema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        date: { type: "string" },
        lunarDate: { type: "string" },
        reason: { type: "string" },
        rating: { type: "number" }
      },
      required: ["date", "lunarDate", "reason", "rating"]
    }
  };

  return await callGeminiAPI(prompt, responseSchema);
}

export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  const prompt = `生肖「${zodiac}」在「${dateStr}」的五行運勢。使用繁體中文回應。`;
  
  const responseSchema = {
    type: "object",
    properties: {
      zodiac: { type: "string" },
      daily: {
        type: "object",
        properties: {
          overall: { type: "string" },
          wealth: { type: "string" },
          love: { type: "string" },
          career: { type: "string" },
          score: { type: "number" }
        },
        required: ["overall", "wealth", "love", "career", "score"]
      },
      monthly: { type: "string" },
      elementAnalysis: { type: "string" }
    },
    required: ["zodiac", "daily", "monthly", "elementAnalysis"]
  };

  return await callGeminiAPI(prompt, responseSchema);
}
