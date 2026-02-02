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
    // 💡 換成 codetabs 代理，這目前對該網站最穩定
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Proxy 失敗');
    const html = await response.text();
    return parseHTML(html, date);
  } catch (error) {
    console.error('爬蟲失敗:', error);
    // 💡 即使失敗也回傳基本格式，防止後續讀取噴錯
    return { 
      date, lunarDate: '讀取失敗', stemBranch: { year: '', month: '', day: '' }, 
      zodiac: '', suitable: [], unsuitable: [], directions: { joy: '', wealth: '', fortune: '' },
      luckyHours: [], hourlyLuck: [] 
    } as any;
  }
}

function parseHTML(html: string, date: string): RealAlmanacData {
  const lunarMatch = html.match(/農曆\s*<\/dt>\s*<dd[^>]*>([^<]+)</);
  return {
    date,
    lunarDate: lunarMatch ? lunarMatch[1].trim() : '無法取得',
    stemBranch: { year: '', month: '', day: '' },
    zodiac: '',
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
