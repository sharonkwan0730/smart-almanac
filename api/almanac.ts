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
    const data = parseAlmanacHtml(html, date);

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
  
  // 嘗試匹配: "農曆十二月十五" 或 "農曆\n十二月十五" 或 "農曆   \n十二月十六"
  // 月份: 正月、二月...十一月、十二月、臘月
  // 日期: 初一~初十、十一~十九、二十、廿一~廿九、三十
  const lunarRegex = /農曆[\s\S]*?(正月|[一二三四五六七八九十冬臘]+月)(初[一二三四五六七八九十]|[一二三]?十[一二三四五六七八九]?|廿[一二三四五六七八九]?|三十)/;
  const lunarMatch = html.match(lunarRegex);
  if (lunarMatch) {
    lunarDate = lunarMatch[1] + lunarMatch[2];
  }

  // ===== 干支年月日 =====
  // 格式: "乙巳蛇年 己丑月 丁未日"
  const stemBranchRegex = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])([鼠牛虎兔龍蛇馬羊猴雞狗豬])年\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])月\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])日/;
  const stemMatch = html.match(stemBranchRegex);
  
  const stemBranch = {
    year: stemMatch ? `${stemMatch[1]}${stemMatch[2]}年` : '乙巳蛇年',
    month: stemMatch ? `${stemMatch[3]}月` : '己丑月',
    day: stemMatch ? `${stemMatch[4]}日` : '丁未日'
  };

  // 生肖
  const zodiac = stemMatch ? stemMatch[2] : '蛇';

  // ===== 節氣 =====
  const solarTermMatch = html.match(/節氣[\s\S]*?(立春|雨水|驚蟄|春分|清明|穀雨|立夏|小滿|芒種|夏至|小暑|大暑|立秋|處暑|白露|秋分|寒露|霜降|立冬|小雪|大雪|冬至|小寒|大寒)/);
  const solarTerm = solarTermMatch ? solarTermMatch[1] : undefined;

  // ===== 宜 =====
  let suitable: string[] = ['祭祀', '祈福'];
  const suitableMatch = html.match(/宜\s*\n\s*([\u4e00-\u9fa5、]+)/);
  if (suitableMatch) {
    suitable = suitableMatch[1]
      .split(/[、，]+/)
      .map(s => s.trim())
      .filter(s => s && s.length <= 4 && s !== '餘事勿取');
  }

  // ===== 忌 =====
  let unsuitable: string[] = ['開市', '動土'];
  const unsuitableMatch = html.match(/忌\s*\n\s*([\u4e00-\u9fa5、]+)/);
  if (unsuitableMatch) {
    unsuitable = unsuitableMatch[1]
      .split(/[、，]+/)
      .map(s => s.trim())
      .filter(s => s && s.length <= 4);
  }

  // ===== 沖 =====
  const clashMatch = html.match(/沖\s*\n\s*\(([^)]+)\)([^\n]+)/);
  const clash = clashMatch ? `${clashMatch[1]}${clashMatch[2]}`.trim() : '';

  // ===== 煞 =====
  const directionMatch = html.match(/煞\s*\n\s*([東西南北]+方?)/);
  const direction = directionMatch ? directionMatch[1] : '';

  // ===== 吉神 =====
  let luckyGods: string[] = [];
  const luckyGodsMatch = html.match(/吉神\s*\n\s*([\u4e00-\u9fa5、]+)/);
  if (luckyGodsMatch) {
    luckyGods = luckyGodsMatch[1].split(/[、，]+/).map(s => s.trim()).filter(s => s);
  }

  // ===== 凶煞 =====
  let unluckyGods: string[] = [];
  const unluckyGodsMatch = html.match(/凶煞\s*\n\s*([\u4e00-\u9fa5、]+)/);
  if (unluckyGodsMatch) {
    unluckyGods = unluckyGodsMatch[1].split(/[、，]+/).map(s => s.trim()).filter(s => s);
  }

  // ===== 方位 =====
  const joyMatch = html.match(/喜神([東西南北正]+)/);
  const fortuneMatch = html.match(/福神([東西南北正]+)/);
  const wealthMatch = html.match(/財神([東西南北正]+)/);
  const directions = {
    joy: joyMatch ? joyMatch[1] : '正南',
    fortune: fortuneMatch ? fortuneMatch[1] : '東南',
    wealth: wealthMatch ? wealthMatch[1] : '西南'
  };

  // ===== 胎神 =====
  const fetalGodMatch = html.match(/胎神\s*\n\s*([\u4e00-\u9fa5\s]+?)(?=\n|吉時)/s);
  const fetalGod = fetalGodMatch ? fetalGodMatch[1].trim().replace(/\s+/g, '') : '';

  // ===== 吉時 =====
  let luckyHours: string[] = ['子', '丑', '寅'];
  const luckyHoursMatch = html.match(/吉時\s*\n\s*([子丑寅卯辰巳午未申酉戌亥、]+)/);
  if (luckyHoursMatch) {
    luckyHours = luckyHoursMatch[1].split(/[、，]+/).map(s => s.trim()).filter(s => s.length === 1);
  }

  // ===== 彭祖百忌 =====
  const pengzuMatch = html.match(/彭祖百忌\s*\n\s*([\u4e00-\u9fa5；;]+)/);
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
