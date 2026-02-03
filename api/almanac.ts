import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { date } = req.query;

  if (!date || typeof date !== 'string') {
    return res.status(400).json({ error: '請提供日期參數，格式：YYYY-MM-DD' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: '日期格式錯誤，請使用 YYYY-MM-DD' });
  }

  try {
    console.log(`📅 爬取農民曆: ${date}`);
    
    const response = await fetch(`https://www.goodaytw.com/${date}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // 先清理 HTML：移除註解和標籤
    const cleanHtml = html
      .replace(/<!--[\s\S]*?-->/g, '')  // 移除 HTML 註解
      .replace(/<br\s*\/?>/gi, '')       // 移除 <br>
      .replace(/<[^>]+>/g, ' ')          // 移除所有 HTML 標籤
      .replace(/\s+/g, ' ');             // 多個空白變成一個
    
    const data = parseAlmanacHtml(cleanHtml, date);

    console.log(`✅ 解析成功:`, data.lunarDate);
    return res.status(200).json(data);

  } catch (error: any) {
    console.error(`❌ 爬取失敗:`, error.message);
    return res.status(500).json({ 
      error: '無法取得農民曆資料',
      message: error.message 
    });
  }
}

function parseAlmanacHtml(html: string, date: string) {
  // ===== 農曆日期 =====
  let lunarDate = '農曆日期';
  
  // 清理後格式: "農曆 十二 月 十六" 或 "農曆十二月十六"
  const lunarRegex = /農曆\s*(十[一二]?|[一二三四五六七八九]|正|冬|臘)\s*月\s*(初[一二三四五六七八九十]|[一二三]?十[一二三四五六七八九]?|廿[一二三四五六七八九]?|三十)/;
  const lunarMatch = html.match(lunarRegex);
  if (lunarMatch) {
    lunarDate = lunarMatch[1] + '月' + lunarMatch[2];
  }

  // ===== 干支年月日 =====
  const stemBranchRegex = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*([鼠牛虎兔龍蛇馬羊猴雞狗豬])\s*年\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*月\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*日/;
  const stemMatch = html.match(stemBranchRegex);
  
  const stemBranch = {
    year: stemMatch ? `${stemMatch[1]}${stemMatch[2]}年` : '乙巳蛇年',
    month: stemMatch ? `${stemMatch[3]}月` : '己丑月',
    day: stemMatch ? `${stemMatch[4]}日` : '丁未日'
  };

  const zodiac = stemMatch ? stemMatch[2] : '蛇';

  // ===== 節氣 =====
  const solarTerms = ['立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];
  let solarTerm: string | undefined;
  for (const term of solarTerms) {
    if (html.includes(term)) {
      solarTerm = term;
      break;
    }
  }

  // ===== 宜 =====
  let suitable: string[] = ['祭祀', '祈福'];
  const suitableMatch = html.match(/宜\s+([^\u5fcc]+?)(?=\s+忌|\s+沖)/);
  if (suitableMatch) {
    suitable = suitableMatch[1]
      .split(/[、，\s]+/)
      .map(s => s.trim())
      .filter(s => s && s.length <= 4 && s !== '餘事勿取');
  }

  // ===== 忌 =====
  let unsuitable: string[] = ['開市', '動土'];
  const unsuitableMatch = html.match(/忌\s+([^\u6c96]+?)(?=\s+沖|\s+煞)/);
  if (unsuitableMatch) {
    unsuitable = unsuitableMatch[1]
      .split(/[、，\s]+/)
      .map(s => s.trim())
      .filter(s => s && s.length <= 4);
  }

  // ===== 沖 =====
  const clashMatch = html.match(/沖\s*\(([^)]+)\)\s*([^\s]+)/);
  const clash = clashMatch ? `${clashMatch[1]}${clashMatch[2]}` : '';

  // ===== 煞 =====
  const directionMatch = html.match(/煞\s+([東西南北]+)/);
  const direction = directionMatch ? directionMatch[1] + '方' : '';

  // ===== 吉神 =====
  let luckyGods: string[] = [];
  const luckyGodsMatch = html.match(/吉神\s+([^\u5169]+?)(?=\s+凶|\s+方位)/);
  if (luckyGodsMatch) {
    luckyGods = luckyGodsMatch[1].split(/[、，\s]+/).map(s => s.trim()).filter(s => s);
  }

  // ===== 凶煞 =====
  let unluckyGods: string[] = [];
  const unluckyGodsMatch = html.match(/凶煞\s+([^\u65b9]+?)(?=\s+方位|\s+胎神)/);
  if (unluckyGodsMatch) {
    unluckyGods = unluckyGodsMatch[1].split(/[、，\s]+/).map(s => s.trim()).filter(s => s);
  }

  // ===== 方位 =====
  const joyMatch = html.match(/喜神\s*([東西南北正]+)/);
  const fortuneMatch = html.match(/福神\s*([東西南北正]+)/);
  const wealthMatch = html.match(/財神\s*([東西南北正]+)/);
  const directions = {
    joy: joyMatch ? joyMatch[1] : '正南',
    fortune: fortuneMatch ? fortuneMatch[1] : '東南',
    wealth: wealthMatch ? wealthMatch[1] : '西南'
  };

  // ===== 胎神 =====
  const fetalGodMatch = html.match(/胎神\s+([^\s吉彭]+)/);
  const fetalGod = fetalGodMatch ? fetalGodMatch[1].trim() : '';

  // ===== 吉時 =====
  let luckyHours: string[] = ['子', '丑', '寅'];
  const luckyHoursMatch = html.match(/吉時\s+([子丑寅卯辰巳午未申酉戌亥、\s]+?)(?=\s+彭祖|$)/);
  if (luckyHoursMatch) {
    luckyHours = luckyHoursMatch[1].split(/[、\s]+/).map(s => s.trim()).filter(s => s.length === 1);
  }

  // ===== 彭祖百忌 =====
  const pengzuMatch = html.match(/彭祖百忌\s+([^©]+?)(?=\s+\d|$)/);
  const pengzu = pengzuMatch ? pengzuMatch[1].trim() : '';

  // ===== 時辰吉凶 =====
  const hourlyLuck = parseHourlyLuck(luckyHours);

  return {
    date,
    lunarDate,
    stemBranch,
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

function parseHourlyLuck(luckyHours: string[]) {
  const hours = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const times = [
    '23:00-01:00', '01:00-03:00', '03:00-05:00', '05:00-07:00',
    '07:00-09:00', '09:00-11:00', '11:00-13:00', '13:00-15:00',
    '15:00-17:00', '17:00-19:00', '19:00-21:00', '21:00-23:00'
  ];

  return hours.map((hour, index) => {
    const isLucky = luckyHours.includes(hour);
    return {
      hour,
      time: times[index],
      suitable: isLucky ? ['祈福', '求財', '出行'] : [],
      unsuitable: isLucky ? [] : ['動土', '安葬'],
      clash: '',
      direction: ''
    };
  });
}
