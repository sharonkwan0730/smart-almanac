import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice } from "./tibetanCalendar";

const getCacheKey = (date: string) => `almanac_cache_v10_${date}`;

// 安全的 localStorage 操作
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn("localStorage 讀取失敗:", e);
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("localStorage 寫入失敗:", e);
  }
}

export async function getAlmanacForDate(dateStr: string, forceRefresh: boolean = false): Promise<AlmanacData> {
  console.log("🔍 開始載入農民曆:", dateStr);
  
  // 檢查快取
  if (!forceRefresh) {
    const cached = safeGetItem(getCacheKey(dateStr));
    if (cached) {
      try { 
        console.log("✅ 使用快取資料");
        return JSON.parse(cached); 
      } catch (e) { 
        console.warn("快取解析失敗"); 
      }
    }
  }

  try {
    console.log("📅 取得農民曆資料...");
    const realData = await fetchRealAlmanac(dateStr);
    console.log("📅 農民曆資料取得成功:", realData);
    
    console.log("🏔️ 取得藏曆資料...");
    const tibetanData = await convertToTibetanCalendar(dateStr);
    console.log("🏔️ 藏曆資料取得成功:", tibetanData);

    // 嘗試從 zangli.pro 取得更詳細的藏曆資料
    let buddhaDay: string | undefined;
    let meritFromApi: string | undefined;
    
    try {
      console.log("🙏 取得 zangli.pro 佛誕日資料...");
      const tibetanResponse = await fetch(`/api/tibetan?date=${dateStr}`);
      if (tibetanResponse.ok) {
        const tibetanApiData = await tibetanResponse.json();
        console.log("🙏 zangli.pro 資料:", tibetanApiData);
        buddhaDay = tibetanApiData.buddhaDay || undefined;
        meritFromApi = tibetanApiData.merit || undefined;
      }
    } catch (e) {
      console.warn("zangli.pro API 失敗，使用本地資料");
    }

    // 如果 API 沒取到，用本地計算的資料
    if (!buddhaDay) {
      buddhaDay = tibetanData.buddhaDay;
    }
    if (!meritFromApi) {
      meritFromApi = tibetanData.merit;
    }

    const result: AlmanacData = {
      solarDate: dateStr,
      lunarDate: realData.lunarDate || '農曆日期',
      solarTerm: realData.solarTerm,
      tibetanData: {
        date: tibetanData.date,
        yearName: tibetanData.year,
        weekday: tibetanData.weekday,
        constellation: tibetanData.constellation,
        yoga: tibetanData.yoga,
        buddhaDay: buddhaDay,
        analysis: buddhaDay 
          ? `今日為${buddhaDay}。建議多行供養、持咒、放生等善行。`
          : '今日宜依照農民曆宜忌安排活動，保持正念修持。',
        auspicious: tibetanData.auspicious,
        inauspicious: tibetanData.inauspicious,
        specialDay: tibetanData.specialDay,
        dharmaAdvice: buddhaDay 
          ? '建議供養、持咒、放生、佈施等善行，功德倍增。'
          : '建議日常持咒、禮佛、行善積德。',
        meritMultiplier: meritFromApi,
        traditionalActivities: {
          haircut: getHaircutAdvice(tibetanData.day),
          windHorse: getWindHorseAdvice(tibetanData.day),
          other: buddhaDay ? ['供養', '持咒', '放生'] : []
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
      dailyAdvice: buddhaDay 
        ? `今日為${buddhaDay}，宜多行善事。農民曆宜${realData.suitable.slice(0, 3).join('、')}。`
        : `農民曆宜${realData.suitable.slice(0, 3).join('、')}${realData.unsuitable.length > 0 ? '，忌' + realData.unsuitable.slice(0, 2).join('、') : ''}。`,
      hourlyLuck: realData.hourlyLuck.map(h => ({
        hour: h.hour,
        period: h.time,
        status: realData.luckyHours.includes(h.hour) ? '吉' : '凶',
        description: h.suitable.length > 0 ? `宜${h.suitable.slice(0, 3).join('、')}` : '諸事不宜'
      }))
    };

    console.log("✅ 資料組合完成:", result);
    safeSetItem(getCacheKey(dateStr), JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("❌ 載入失敗:", error);
    throw error;
  }
}

export async function findLuckyDates(event: EventType, month: string): Promise<DateRecommendation[]> {
  return [];
}

export async function getZodiacFortune(zodiac: ZodiacType, dateStr: string): Promise<ZodiacFortune> {
  return {
    zodiac,
    daily: {
      overall: '請參考農民曆宜忌',
      wealth: '平穩',
      love: '平穩',
      career: '平穩',
      score: 75
    },
    monthly: '請參考農民曆',
    elementAnalysis: '請參考農民曆'
  };
}
