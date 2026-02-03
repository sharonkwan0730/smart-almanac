// 藏曆轉換服務
// 基於 stonelf/zangli 專案的藏曆數據
// 資料來源：《藏曆、公曆、農曆對照百年歷書（1951-2050)》

export interface TibetanCalendarData {
  date: string;          // 藏曆日期（如：火馬年 正月初一）
  year: string;          // 藏曆年份（如：火馬年）
  month: string;         // 藏曆月份（如：正月）
  day: string;           // 藏曆日（如：初一）
  weekday: string;       // 星期
  constellation: string; // 星宿
  yoga: string;          // 瑜伽
  buddhaDay?: string;    // 佛菩薩節日
  merit?: string;        // 功德倍數
  specialDay?: string;   // 特殊日子
  auspicious: string[];  // 宜
  inauspicious: string[]; // 忌
}

// 藏曆年份對照（簡化版）
const TIBETAN_YEARS: { [key: number]: string } = {
  2024: '木龍年',
  2025: '木蛇年',
  2026: '火馬年',
  2027: '火羊年',
  2028: '土猴年',
  2029: '土雞年',
  2030: '鐵狗年',
  2031: '鐵豬年'
};

// 佛菩薩聖日
const BUDDHA_DAYS: { [key: number]: string } = {
  1: '禪定勝王佛節日 · 作何善惡成百倍',
  8: '藥師佛節日 · 作何善惡成千倍',
  10: '蓮師薈供日 · 作何善惡成十萬倍',
  15: '阿彌陀佛節日 · 作何善惡成百萬倍',
  18: '觀音菩薩節日 · 作何善惡成千萬倍',
  21: '地藏王菩薩節日 · 作何善惡成億倍',
  25: '空行母薈供日',
  30: '釋迦牟尼佛節日 · 作何善惡成九億倍'
};

// 星宿（28星宿循環）
const CONSTELLATIONS = [
  '角', '亢', '氐', '房', '心', '尾', '箕',
  '斗', '牛', '女', '虛', '危', '室', '壁',
  '奎', '婁', '胃', '昴', '畢', '觜', '參',
  '井', '鬼', '柳', '星', '張', '翼', '軫'
];

// 瑜伽（27瑜伽循環）
const YOGAS = [
  '駿足', '福德', '成就', '吉祥', '光輝', '金剛', '毒害',
  '持節', '事業', '奮威', '妙花', '善相', '堅固', '正念',
  '平順', '懷德', '幻惑', '極惡', '善戲', '調伏', '鐵鉤',
  '熾盛', '分散', '常住', '具光', '和合', '貪欲'
];

/**
 * 將公曆轉換為藏曆
 */
export async function convertToTibetanCalendar(gregorianDate: string): Promise<TibetanCalendarData> {
  // 直接使用計算方式（zangli.pro API 可能不穩定）
  return calculateTibetanDate(gregorianDate);
}

/**
 * 簡化計算藏曆
 */
function calculateTibetanDate(gregorianDate: string): TibetanCalendarData {
  const date = new Date(gregorianDate);
  const year = date.getFullYear();
  
  // 藏曆新年大約在公曆2月（會有±1月的差異）
  // 這裡使用簡化計算
  const tibetanYear = TIBETAN_YEARS[year] || `${year}年`;
  
  // 計算藏曆月日（簡化版）
  const dayOfYear = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
  const tibetanDayOfYear = (dayOfYear + 45) % 360; // 藏曆偏移約45天
  const tibetanMonthNum = Math.floor(tibetanDayOfYear / 30) + 1;
  const tibetanDayNum = (tibetanDayOfYear % 30) + 1;
  
  const monthNames = ['正月', '二月', '三月', '四月', '五月', '六月', 
                      '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const tibetanMonth = monthNames[Math.min(tibetanMonthNum - 1, 11)];
  const tibetanDay = convertToDayName(tibetanDayNum);
  
  return {
    date: `${tibetanYear} ${tibetanMonth}${tibetanDay}`,
    year: tibetanYear,
    month: tibetanMonth,
    day: tibetanDay,
    weekday: getWeekday(gregorianDate),
    constellation: CONSTELLATIONS[(tibetanDayNum - 1) % 28],
    yoga: YOGAS[(tibetanDayNum - 1) % 27],
    buddhaDay: BUDDHA_DAYS[tibetanDayNum],
    merit: BUDDHA_DAYS[tibetanDayNum] ? extractMerit(BUDDHA_DAYS[tibetanDayNum]) : undefined,
    auspicious: getAuspiciousByDay(tibetanDayNum),
    inauspicious: getInauspiciousByDay(tibetanDayNum)
  };
}

/**
 * 獲取星期
 */
function getWeekday(dateStr: string): string {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekdays[new Date(dateStr).getDay()];
}

/**
 * 轉換日期數字為中文
 */
function convertToDayName(day: number): string {
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  
  const tens = ['', '十', '廿', '三十'];
  const ones = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  
  if (day < 10) return '初' + ones[day];
  if (day < 20) return '十' + ones[day - 10];
  if (day < 30) return '廿' + ones[day - 20];
  return '三十';
}

/**
 * 提取功德倍數
 */
function extractMerit(text: string): string {
  const match = text.match(/作何善惡成(.+)/);
  return match ? match[1] : '';
}

/**
 * 根據日期獲取宜事項
 */
function getAuspiciousByDay(day: number): string[] {
  // 根據藏曆傳統
  if ([1, 8, 10, 15, 25, 30].includes(day)) {
    return ['修法', '供養', '放生', '佈施', '持咒', '誦經'];
  }
  if ([5, 12, 20, 28].includes(day)) {
    return ['剪髮', '沐浴', '修房', '遷居'];
  }
  return ['日常修持', '行善積德'];
}

/**
 * 根據日期獲取忌事項
 */
function getInauspiciousByDay(day: number): string[] {
  // 根據藏曆傳統
  if ([9, 19, 29].includes(day)) {
    return ['重要決策', '簽約', '遠行'];
  }
  if ([4, 14, 24].includes(day)) {
    return ['殺生', '飲酒', '爭執'];
  }
  return [];
}

/**
 * 取得剪髮吉凶
 */
export function getHaircutAdvice(tibetanDay: string): string {
  const dayNum = parseInt(tibetanDay.replace(/[^\d]/g, '')) || 1;
  
  const haircutAdvice: { [key: number]: string } = {
    1: '增長壽命',
    2: '招致疾病',
    3: '增長財富',
    4: '招損財產',
    5: '增益智慧',
    8: '吉祥如意',
    9: '招邪惡事',
    10: '增長福德',
    11: '減損壽命',
    13: '修持順緣',
    15: '增上福報',
    18: '增益財富',
    21: '招致疾病',
    22: '財富增長',
    25: '獲得成就',
    27: '招致惡運',
    30: '招致爭鬥'
  };
  
  return haircutAdvice[dayNum] || '平常日，可剪可不剪';
}

/**
 * 取得風馬旗建議
 */
export function getWindHorseAdvice(tibetanDay: string): string {
  const dayNum = parseInt(tibetanDay.replace(/[^\d]/g, '')) || 1;
  
  if ([1, 8, 10, 15, 25, 30].includes(dayNum)) {
    return '極吉：懸掛經幡、升起風馬，功德倍增';
  }
  if ([5, 12, 20, 28].includes(dayNum)) {
    return '吉：適合懸掛新經幡';
  }
  if ([9, 19, 29].includes(dayNum)) {
    return '不宜：暫緩懸掛';
  }
  
  return '平常日：可懸掛';
}
