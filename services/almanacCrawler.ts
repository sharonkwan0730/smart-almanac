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
    // 💡 修正：使用 allorigins raw 模式並加上 timestamp 防止被代理伺服器快取錯誤頁面
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&ts=${Date.now()}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('網路請求失敗');
    const html = await response.text();
    return parseHTML(html, date);
  } catch (error) {
    console.error('爬蟲失敗:', error);
    throw error;
  }
}

function parseHTML(html: string, date: string): RealAlmanacData {
  const getMatch = (regex: RegExp, index: number = 1) => {
    const m = html.match(regex);
    return m ? m[index].trim() : '';
  };

  const lunarDate = getMatch(/農曆\s*<\/dt>\s*<dd[^>]*>([^<]+)</);
  const stemYear = getMatch(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥][鼠牛虎兔龍蛇馬羊猴雞狗豬]年)/);
  const stemMonth = getMatch(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])月/);
  const stemDay = getMatch(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])日/);
  const zodiac = stemYear.length > 2 ? stemYear.charAt(2) : '';

  // 宜忌
  const suitableText = getMatch(/宜\s*<\/dt>\s*<dd[^>]*>([^<]+)</);
  const suitable = suitableText.split('、').filter(s => s && s !== '餘事勿取');

  const unsuitableText = getMatch(/忌\s*<\/dt>\s*<dd[^>]*>([^<]+)</);
  const unsuitable = unsuitableText.split('、');

  return {
    date,
    lunarDate,
    stemBranch: { year: stemYear, month: stemMonth, day: stemDay },
    zodiac,
    suitable,
    unsuitable,
    clash: getMatch(/沖\s*<\/dt>\s*<dd[^>]*>\(([^)]+)\)/),
    direction: getMatch(/沖\s*<\/dt>\s*<dd[^>]*>\([^)]+\)([^<\n]+)/),
    luckyGods: getMatch(/吉神\s*<\/dt>\s*<dd[^>]*>([^<]+)/).split('、'),
    unluckyGods: getMatch(/凶煞\s*<\/dt>\s*<dd[^>]*>([^<]+)/).split('、'),
    directions: { joy: '', wealth: '', fortune: '' },
    fetalGod: getMatch(/胎神\s*<\/dt>\s*<dd[^>]*>([^<]+)/),
    luckyHours: getMatch(/吉時\s*<\/dt>\s*<dd[^>]*>([^<]+)/).split('、'),
    pengzu: getMatch(/彭祖百忌\s*<\/dt>\s*<dd[^>]*>([^<]+)/),
    hourlyLuck: parseHourlyLuck(html)
  };
}

function parseHourlyLuck(html: string): HourlyLuck[] {
  const hours = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const times = ['23-01', '01-03', '03-05', '05-07', '07-09', '09-11', '11-13', '13-15', '15-17', '17-19', '19-21', '21-23'];
  return hours.map((h, i) => ({
    hour: h,
    time: times[i],
    suitable: [],
    unsuitable: [],
    clash: '',
    direction: ''
  }));
}
