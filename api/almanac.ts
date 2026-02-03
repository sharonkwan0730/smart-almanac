import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 設定 CORS
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
  // 農曆日期 - 多種格式嘗試
  let lunarDate = '農曆日期';
  
  // 格式1: "農曆十二月十五" 或 "農曆   \n十二月十五"
  const lunarMatch1 = html.match(/農曆[\s\n]*([一二三四五六七八九十]+月[一二三四五六七八九十廿卅初]+)/);
  if (lunarMatch1) {
    lunarDate = lunarMatch1[1];
  }
  
  // 格式2: 直接找 "X月初X" 或 "X月十X" 或 "X月廿X"
  if (lunarDate === '農曆日期') {
    const lunarMatch2 = html.match(/([一二三四五六七八九十]+月)(初[一二三四五六七八九十]+|[一二三四五六七八九十廿卅]+)/);
    if (lunarMatch2) {
      lunarDate = lunarMatch2[1] + lunarMatch2[2];
    }
  }

  // 格式3: 找類似 "十二月十五" 的獨立文字
  if (lunarDate === '農曆日期') {
    const lunarMatch3 = html.match(/(十[一二]?月|[一二三四五六七八九]月)(初[一二三四五六七八九十]+|十[一二三四五六七八九]?|二十[一二三四五六七八九]?|廿[一二三四五六七八九]?|三十)/);
    if (lunarMatch3) {
      lunarDate = lunarMatch3[1] + lunarMatch3[2];
    }
  }

  // 干支年月日
  const yearMatch = html.match(/(乙巳|丙午|丁未|戊申|己酉|庚戌|辛亥|壬子|癸丑|甲寅)([\u4e00-\u9fa5])年/);
  const monthDayMatch = html.match(/([\u4e00-\u9fa5]{2})月\s*([\u4e00-\u9fa5]{2})日/);
  
  const stemBranch = {
    year: yearMatch ? `${yearMatch[1]}${yearMatch[2]}年` : '乙巳蛇年',
    month: monthDayMatch ? `${monthDayMatch[1]}月` : '月',
    day: monthDayMatch ? `${monthDayMatch[2]}日` : '日'
  };

  // 生肖
  const zodiac = yearMatch ? yearMatch[2] : '蛇';

  // 節氣
  const solarTermMatch = html.match(/節氣[\s\n]*([\u4e00-\u9fa5]+)/);
  const solarTerm = solarTermMatch ? solarTermMatch[1] : undefined;

  // 宜 - 改進解析
  let suitable: string[] = ['祭祀', '祈福'];
  const suitableMatch = html.match(/宜\s*\n?\s*([\u4e00-\u9fa5、，\s]+?)(?=\n|忌|沖)/s);
  if (suitableMatch) {
    suitable = suitableMatch[1]
      .split(/[、，\n\s]+/)
      .map(s => s.trim())
      .filter(s => s && s.length <= 4 && s !== '餘事勿取');
  }

  // 忌
  let unsuitable: string[] = ['開市', '動土'];
  const unsuitableMatch = html.match(/忌\s*\n?\s*([\u4e00-\u9fa5、，\s]+?)(?=\n|沖|煞)/s);
  if (unsuitableMatch) {
    unsuitable = unsuitableMatch[1]
      .split(/[、，\n\s]+/)
      .map(s => s.trim())
      .filter(s => s && s.length <= 4);
  }

  // 沖
  const clashMatch = html.match(/沖\s*[\(（]?([\u4e00-\u9fa5]+)[\)）]?([\u4e00-\u9fa5])/);
  const clash = clashMatch ? `${clashMatch[1]}${clashMatch[2]}` : '';

  // 煞
  const directionMatch = html.match(/煞\s*\n?\s*([\u4e00-\u9fa5]+方)/);
  const direction = directionMatch ? directionMatch[1] : '';

  // 吉神
  let luckyGods: string[] = [];
  const luckyGodsMatch = html.match(/吉神\s*\n?\s*([\u4e00-\u9fa5、，\s]+?)(?=\n|凶|方位)/s);
  if (luckyGodsMatch) {
    luckyGods = luckyGodsMatch[1]
      .split(/[、，\n\s]+/)
      .map(s => s.trim())
      .filter(s => s);
  }

  // 凶煞
  let unluckyGods: string[] = [];
  const unluckyGodsMatch = html.match(/凶煞\s*\n?\s*([\u4e00-\u9fa5、，\s]+?)(?=\n|方位|胎神)/s);
  if (unluckyGodsMatch) {
    unluckyGods = unluckyGodsMatch[1]
      .split(/[、，\n\s]+/)
      .map(s => s.trim())
      .filter(s => s);
  }

  // 方位
  const joyMatch = html.match(/喜神\s*([\u4e00-\u9fa5]+)/);
  const fortuneMatch = html.match(/福神\s*([\u4e00-\u9fa5]+)/);
  const wealthMatch = html.match(/財神\s*([\u4e00-\u9fa5]+)/);
  const directions = {
    joy: joyMatch ? joyMatch[1] : '正南',
    fortune: fortuneMatch ? fortuneMatch[1] : '東南',
    wealth: wealthMatch ? wealthMatch[1] : '西南'
  };

  // 胎神
  const fetalGodMatch = html.match(/胎神\s*\n?\s*([\u4e00-\u9fa5\s]+?)(?=\n|吉時|彭祖)/s);
  const fetalGod = fetalGodMatch ? fetalGodMatch[1].trim() : '';

  // 吉時
  let luckyHours: string[] = ['子', '丑', '寅'];
  const luckyHoursMatch = html.match(/吉時\s*\n?\s*([\u4e00-\u9fa5、，\s]+?)(?=\n|彭祖)/s);
  if (luckyHoursMatch) {
    luckyHours = luckyHoursMatch[1]
      .split(/[、，\n\s]+/)
      .map(s => s.trim())
      .filter(s => s && s.length === 1);
  }

  // 彭祖百忌
  const pengzuMatch = html.match(/彭祖百忌\s*\n?\s*([\u4e00-\u9fa5；;，、\s]+)/);
  const pengzu = pengzuMatch ? pengzuMatch[1].trim() : '';

  // 時辰吉凶
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
