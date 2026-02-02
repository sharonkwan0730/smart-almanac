// services/almanacCrawler.ts
export async function fetchRealAlmanac(date: string): Promise<any> {
  const url = `https://www.goodaytw.com/${date}`;
  try {
    // 💡 換成 allorigins 的 raw 模式
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Proxy 失敗');
    const html = await response.text();
    return parseHTML(html, date);
  } catch (error) {
    console.error('爬蟲失敗:', error);
    // 💡 即使失敗也要回傳基本結構，防止後端崩潰
    return { lunarDate: '讀取中', stemBranch: { year: '', month: '', day: '' }, luckyHours: [], hourlyLuck: [] };
  }
}

function parseHTML(html: string, date: string): any {
  const lunarMatch = html.match(/農曆\s*<\/dt>\s*<dd[^>]*>([^<]+)</);
  return {
    date,
    lunarDate: lunarMatch ? lunarMatch[1].trim() : '無法讀取',
    stemBranch: { year: '', month: '', day: '' },
    suitable: [], unsuitable: [], directions: { joy: '', wealth: '', fortune: '' },
    luckyHours: [], hourlyLuck: []
  };
}
