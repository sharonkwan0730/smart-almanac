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
    // 💡 換回 allorigins 的 raw 模式，這目前對 goodaytw 最穩定
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Proxy error');
    const html = await response.text();
    return parseHTML(html, date);
  } catch (error) {
    console.error('Crawler failed:', error);
    throw error;
  }
}

function parseHTML(html: string, date: string): RealAlmanacData {
  const getMatch = (regex: RegExp, def: string = '') => {
    const m = html.match(regex);
    return m ? m[1].trim() : def;
  };

  const lunarDate = getMatch(/農曆\s*<\/dt>\s*<dd[^>]*>([^<]+)</);
  const stemYear = getMatch(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥][鼠牛虎兔龍蛇馬羊猴雞狗豬]年)/);
  const zodiac = stemYear.includes('年') ? stemYear.substring(2, 3) : '';
  
  return {
    date,
    lunarDate,
    stemBranch: { year: stemYear, month: '', day: '' },
    zodiac: zodiac,
    suitable: [],
    unsuitable: [],
    clash: '',
    direction: '',
    luckyGods: [],
    unluckyGods: [],
    directions: { joy: '', wealth: '', fortune: '' },
    fetalGod: '',
    luckyHours: [],
    pengzu: '',
    hourlyLuck: []
  };
}
