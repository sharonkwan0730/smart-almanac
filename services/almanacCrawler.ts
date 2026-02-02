// services/almanacCrawler.ts

export interface HourlyLuck {
  hour: string;
  time: string;
  suitable: string[];
  unsuitable: string[];
  clash: string;
  direction: string;
}

export interface RealAlmanacData {
  date: string;
  lunarDate: string;
  stemBranch: { year: string; month: string; day: string; };
  zodiac: string;
  solarTerm?: string;
  suitable: string[];
  unsuitable: string[];
  clash: string;
  direction: string;
  luckyGods: string[];
  unluckyGods: string[];
  directions: { joy: string; wealth: string; fortune: string; };
  fetalGod: string;
  luckyHours: string[];
  pengzu: string;
  hourlyLuck: HourlyLuck[];
}

export async function fetchRealAlmanac(date: string): Promise<RealAlmanacData> {
  const url = `https://www.goodaytw.com/${date}`;
  try {
    // ✅ 換成 corsproxy.io
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('CORS 代理失敗');
    const html = await response.text();
    return parseHTML(html, date);
  } catch (error) {
    console.error('爬取失敗:', error);
    throw error;
  }
}

function parseHTML(html: string, date: string): RealAlmanacData {
  const lunarMatch = html.match(/農曆\s*<\/dt>\s*<dd[^>]*>([^<]+)</);
  const lunarDate = lunarMatch ? lunarMatch[1].trim() : '';
  const stemYearMatch = html.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])([鼠牛虎兔龍蛇馬羊猴雞狗豬])年/);
  const stemMonthMatch = html.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])月/);
  const stemDayMatch = html.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])日/);
  
  const stemYear = stemYearMatch ? stemYearMatch[1] + stemYearMatch[2] + '年' : '';
  const stemMonth = stemMonthMatch ? stemMonthMatch[1] + '月' : '';
  const stemDay = stemDayMatch ? stemDayMatch[1] + '日' : '';
  const zodiac = stemYearMatch ? stemYearMatch[2] : '';
  
  const solarTermMatch = html.match(/節氣([^<\n，]+)/);
  const solarTerm = solarTermMatch ? solarTermMatch[1].trim() : undefined;
  
  const suitableMatch = html.match(/宜\s*<\/dt>\s*<dd[^>]*>([^<]+)</);
  const suitable = suitableMatch ? suitableMatch[1].split('、').map(s => s.trim()).filter(s => s && s !== '餘事勿取') : [];
  
  const unsuitableMatch = html.match(/忌\s*<\/dt>\s*<dd[^>]*>([^<]+)</);
  const unsuitable = unsuitableMatch ? unsuitableMatch[1].split('、').map(s => s.trim()) : [];
  
  const clashMatch = html.match(/沖\s*<\/dt>\s*<dd[^>]*>\(([^)]+)\)([^<\n]+)/);
  const clash = clashMatch ? clashMatch[1] : '';
  const direction = clashMatch ? clashMatch[2].trim() : '';
  
  const luckyGodsMatch = html.match(/吉神\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const luckyGods = luckyGodsMatch ? luckyGodsMatch[1].split('、').map(s => s.trim()) : [];
  const unluckyGodsMatch = html.match(/凶煞\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const unluckyGods = unluckyGodsMatch ? unluckyGodsMatch[1].split('、').map(s => s.trim()) : [];
  
  const directionsMatch = html.match(/喜神([^\s]+)\s+福神([^\s]+)\s+財神([^\s]+)/);
  const directions = directionsMatch ? { joy: directionsMatch[1], fortune: directionsMatch[2], wealth: directionsMatch[3] } : { joy: '', wealth: '', fortune: '' };
  
  const fetalGodMatch = html.match(/胎神\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const fetalGod = fetalGodMatch ? fetalGodMatch[1].trim() : '';
  
  const luckyHoursMatch = html.match(/吉時\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const luckyHours = luckyHoursMatch ? luckyHoursMatch[1].split('、').map(s => s.trim()) : [];
  
  const pengzuMatch = html.match(/彭祖百忌\s*<\/dt>\s*<dd[^>]*>([^<]+)/);
  const pengzu = pengzuMatch ? pengzuMatch[1].trim() : '';
  
  return {
    date, lunarDate, stemBranch: { year: stemYear, month: stemMonth, day: stemDay },
    zodiac, solarTerm, suitable, unsuitable, clash, direction,
    luckyGods, unluckyGods, directions, fetalGod, luckyHours, pengzu, hourlyLuck: []
  };
}
