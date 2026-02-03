import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType } from "../types";
import { fetchRealAlmanac } from "./almanacCrawler";
import { convertToTibetanCalendar, getHaircutAdvice, getWindHorseAdvice } from "./tibetanCalendar";

const getCacheKey = (date: string) => `almanac_cache_v9_${date}`;

export async function getAlmanacForDate(dateStr: string, forceRefresh: boolean = false): Promise<AlmanacData> {
  if (!forceRefresh) {
    const cached = localStorage.getItem(getCacheKey(dateStr));
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.warn("Cache error"); }
    }
  }

  try {
    const realData = await fetchRealAlmanac(dateStr);
    const tibetanData = await convertToTibetanCalendar(dateStr);

    const result: AlmanacData = {
      solarDate: dateStr,
      lunarDate: realData.lunarDate || '載入中',
      solarTerm: realData.solarTerm,
      tibetanData: {
        date: tibetanData.date,
        yearName: tibetanData.year,
        weekday: tibetanData.weekday,
        constellation: tibetanData.constellation,
        yoga: tibetanData.yoga,
        analysis: tibetanData.buddhaDay 
          ? `今日為${tibetanData.buddhaDay}。建議多行供養、持咒、放生等善行。`
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
        : `農民曆宜${realData.suitable.slice(0, 3).join('、')}${realData.unsuitable.length > 0 ? '，忌' + realData.unsuitable.slice(0, 2).join('、') : ''}。`,
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
    console.error("載入失敗:", error);
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
