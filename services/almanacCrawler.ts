// 從 goodaytw.com 爬取真實農民曆資料

export interface RealAlmanacData {
  date: string;
  lunarDate: string;
  stemBranch: {
    year: string;
    month: string;
    day: string;
  };
  zodiac: string;
  solarTerm?: string;
  suitable: string[];
  unsuitable: string[];
  clash: string;
  direction: string;
  luckyGods: string[];
  unluckyGods: string[];
  directions: {
    joy: string;
    wealth: string;
    fortune: string;
  };
  fetalGod: string;
  luckyHours: string[];
  pengzu: string;
  hourlyLuck: HourlyLuck[];
}

export interface HourlyLuck {
  hour: string;
  time: string;
  suitable: string[];
  unsuitable: string[];
  clash: string;
  direction: string;
}

// 爬取農民曆
export async function fetchRealAlmanac(date: string): Promise<RealAlmanacData> {
  try {
    // 使用自己的 Vercel Function
    const apiUrl = `/api/fetch-almanac?date=${date}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) throw new Error('API 失敗');
    
    const html = await response.text();
    console.log('HTML 長度:', html.length);
    return parseHTML(html, date);
  } catch (error) {
    console.error('爬取失敗:', error);
    throw new Error('無法取得農民曆資料');
  }
}

function parseHTML(html: string, date: string): RealAlmanacData {
  // 農曆 - 更強的正則
  let lunarDate = '';
  const lunarPatterns = [
    /農曆\s*<\/dt>\s*<dd[^>]*>\s*([^<]+)/,
    /農曆[\s\S]{0,100}?(正月|二月|三月|四月|五月|六月|七月|八月|九月|十月|十一月|十二月|臘月)([^<>\s]{1,5})/,
    /(\d+)月(\d+)日[\s\S]{0,50}?農曆[\s\S]{0,50}?([^<>\s]{2,10})/
  ];
  
  for (const pattern of lunarPatterns) {
    const match = html.match(pattern);
    if (match) {
      lunarDate = match[1] ? match[1].trim() : (match[2] ? match[1] + match[2] : '');
      if (lunarDate) break;
    }
  }
  
  console.log('農曆解析結果:', lunarDate);
  
  // 干支
  const stemYearMatch = html.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])([鼠牛虎兔龍蛇馬羊猴雞狗豬])年/);
  const stemMonthMatch = html.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])月/);
  const stemDayMatch = html.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])日/);
  
  const stemYear = stemYearMatch ? stemYearMatch[1] + stemYearMatch[2] + '年' : '';
  const stemMonth = stemMonthMatch ? stemMonthMatch[1] + '月' : '';
  const stemDay = stemDayMatch ? stemDayMatch[1] + '日' : '';
  const zodiac = stemYearMatch ? stemYearMatch[2] : '';
  
  // 節氣
  const solarTermMatch = html.match(/節氣([^<\n，]+)/);
  const solarTerm = solarTermMatch ? solarTermMatch[1].trim() : undefined;
  
  // 宜忌
  const suitableMatch = html.match(/宜\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const suitable = suitableMatch 
    ? suitableMatch[1].split('、').map(s => s.trim()).filter(s => s && s !== '餘事勿取')
    : [];
  
  const unsuitableMatch = html.match(/忌\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const unsuitable = unsuitableMatch 
    ? unsuitableMatch[1].split('、').map(s => s.trim())
    : [];
  
  // 沖煞
  const clashMatch = html.match(/沖\s*<\/dt>\s*<dd[^>]*>\(([^)]+)\)([^<\n]+)/);
  const clash = clashMatch ? clashMatch[1] : '';
  const direction = clashMatch ? clashMatch[2].trim() : '';
  
  // 吉神凶煞
  const luckyGodsMatch = html.match(/吉神\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const luckyGods = luckyGodsMatch 
    ? luckyGodsMatch[1].split('、').map(s => s.trim())
    : [];
  
  const unluckyGodsMatch = html.match(/凶煞\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const unluckyGods = unluckyGodsMatch 
    ? unluckyGodsMatch[1].split('、').map(s => s.trim())
    : [];
  
  // 方位
  const directionsMatch = html.match(/喜神([^\s]+)\s+福神([^\s]+)\s+財神([^\s]+)/);
  const directions = directionsMatch ? {
    joy: directionsMatch[1],
    fortune: directionsMatch[2],
    wealth: directionsMatch[3]
  } : { joy: '', wealth: '', fortune: '' };
  
  // 胎神
  const fetalGodMatch = html.match(/胎神\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const fetalGod = fetalGodMatch ? fetalGodMatch[1].trim() : '';
  
  // 吉時
  const luckyHoursMatch = html.match(/吉時\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const luckyHours = luckyHoursMatch 
    ? luckyHoursMatch[1].split('、').map(s => s.trim())
    : [];
  
  // 彭祖百忌
  const pengzuMatch = html.match(/彭祖百忌\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const pengzu = pengzuMatch ? pengzuMatch[1].trim() : '';
  
  // 時辰吉凶
  const hourlyLuck = parseHourlyLuck(html);
  
  console.log('完整解析結果:', {
    lunarDate,
    stemYear,
    stemMonth,
    stemDay,
    zodiac,
    suitable: suitable.slice(0, 3),
    unsuitable: unsuitable.slice(0, 3)
  });
  
  return {
    date,
    lunarDate,
    stemBranch: {
      year: stemYear,
      month: stemMonth,
      day: stemDay
    },
    zodiac,
    solarTerm,
    suitable,
    unsuitable,
    clash,
    direction,
    luckyGods,
    unluckyGods,
    directions,
    fetalGod,
    luckyHours,
    pengzu,
    hourlyLuck
  };
}

function parseHourlyLuck(html: string): HourlyLuck[] {
  const hours = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const times = [
    '23:00-01:00', '01:00-03:00', '03:00-05:00', '05:00-07:00',
    '07:00-09:00', '09:00-11:00', '11:00-13:00', '13:00-15:00',
    '15:00-17:00', '17:00-19:00', '19:00-21:00', '21:00-23:00'
  ];
  
  const result: HourlyLuck[] = [];
  
  hours.forEach((hour, index) => {
    const pattern = new RegExp(
      `${hour}[\\s\\S]*?宜[\\s\\S]*?([^忌]*?)忌[\\s\\S]*?([^沖]*?)沖[\\s\\S]*?\\(([^)]+)\\)([^<]*?)(?=${hours[index + 1] || '©'})`,
      'i'
    );
    const match = html.match(pattern);
    
    if (match) {
      const suitableText = match[1].trim();
      const unsuitableText = match[2].trim();
      
      result.push({
        hour,
        time: times[index],
        suitable: suitableText && suitableText !== '無' 
          ? suitableText.split('、').map(s => s.trim()).filter(s => s)
          : [],
        unsuitable: unsuitableText && unsuitableText !== '無' && unsuitableText !== '諸事不宜'
          ? unsuitableText.split('、').map(s => s.trim()).filter(s => s)
          : unsuitableText === '諸事不宜' ? ['諸事不宜'] : [],
        clash: match[3] || '',
        direction: match[4]?.trim() || ''
      });
    } else {
      result.push({
        hour,
        time: times[index],
        suitable: [],
        unsuitable: [],
        clash: '',
        direction: ''
      });
    }
  });
  
  return result;
}
