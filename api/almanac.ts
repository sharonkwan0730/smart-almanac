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

  // 驗證日期格式
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

// 解析 HTML 取得農民曆資料
function parseAlmanacHtml(html: string, date: string) {
  // 農曆日期 (例如：十二月十五)
  const lunarMatch = html.match(/農曆\s*([\u4e00-\u9fa5]+月[\u4e00-\u9fa5]+)/);
  const lunarDate = lunarMatch ? lunarMatch[1] : '農曆日期';

  // 干支 (例如：乙巳蛇年 己丑月 丁未日)
  const yearMatch = html.match(/([\u4e00-\u9fa5]{2}[\u4e00-\u9fa5]年)/);
  const monthMatch = html.match(/([\u4e00-\u9fa5]{2}月)/g);
  const dayMatch = html.match(/([\u4e00-\u9fa5]{2}日)/);
  
  const stemBranch = {
    year: yearMatch ? yearMatch[1] : '年',
    month: monthMatch && monthMatch[1] ? monthMatch[1] : '月',
    day: dayMatch ? dayMatch[1] : '日'
  };

  // 生肖
  const zodiacMatch = html.match(/乙巳([\u4e00-\u9fa5])年|丙午([\u4e00-\u9fa5])年|丁未([\u4e00-\u9fa5])年/);
  const zodiac = zodiacMatch ? (zodiacMatch[1] || zodiacMatch[2] || zodiacMatch[3] || '蛇') : '蛇';

  // 節氣
  const solarTermMatch = html.match(/節氣\s*([\u4e00-\u9fa5]+)/);
  const solarTerm = solarTermMatch ? solarTermMatch[1] : undefined;

  // 宜
  const suitableMatch = html.match(/宜\s*([\u4e00-\u9fa5、]+?)(?=忌|沖|$)/s);
  const suitable = suitableMatch 
    ? suitableMatch[1].split(/[、，\s]+/).filter(s => s && s !== '餘事勿取')
    : ['祭祀', '祈福'];

  // 忌
  const unsuitableMatch = html.match(/忌\s*([\u4e00-\u9fa5、]+?)(?=沖|煞|$)/s);
  const unsuitable = unsuitableMatch
    ? unsuitableMatch[1].split(/[、，\s]+/).filter(s => s)
    : ['開市', '動土'];

  // 沖
  const clashMatch = html.match(/沖\s*[\(（]([\u4e00-\u9fa5]+)[\)）]([\u4e00-\u9fa5])/);
  const clash = clashMatch ? `${clashMatch[1]}${clashMatch[2]}` : '';

  // 煞
  const directionMatch = html.match(/煞\s*([\u4e00-\u9fa5]+方)/);
  const direction = directionMatch ? directionMatch[1] : '';

  // 吉神
  const luckyGodsMatch = html.match(/吉神\s*([\u4e00-\u9fa5、]+?)(?=凶|方位|$)/s);
  const luckyGods = luckyGodsMatch
    ? luckyGodsMatch[1].split(/[、，\s]+/).filter(s => s)
    : [];

  // 凶煞
  const unluckyGodsMatch = html.match(/凶煞\s*([\u4e00-\u9fa5、]+?)(?=方位|胎神|$)/s);
  const unluckyGods = unluckyGodsMatch
    ? unluckyGodsMatch[1].split(/[、，\s]+/).filter(s => s)
    : [];

  // 方位 (喜神、福神、財神)
  const joyMatch = html.match(/喜神([\u4e00-\u9fa5]+)/);
  const fortuneMatch = html.match(/福神([\u4e00-\u9fa5]+)/);
  const wealthMatch = html.match(/財神([\u4e00-\u9fa5]+)/);
  const directions = {
    joy: joyMatch ? joyMatch[1] : '東方',
    fortune: fortuneMatch ? fortuneMatch[1] : '南方',
    wealth: wealthMatch ? wealthMatch[1] : '西方'
  };

  // 胎神
  const fetalGodMatch = html.match(/胎神\s*([\u4e00-\u9fa5\s]+?)(?=吉時|彭祖|$)/s);
  const fetalGod = fetalGodMatch ? fetalGodMatch[1].trim() : '';

  // 吉時
  const luckyHoursMatch = html.match(/吉時\s*([\u4e00-\u9fa5、]+?)(?=彭祖|$)/s);
  const luckyHours = luckyHoursMatch
    ? luckyHoursMatch[1].split(/[、，\s]+/).filter(s => s)
    : ['子', '丑', '寅'];

  // 彭祖百忌
  const pengzuMatch = html.match(/彭祖百忌\s*([\u4e00-\u9fa5；;]+)/);
  const pengzu = pengzuMatch ? pengzuMatch[1] : '';

  // 解析時辰吉凶
  const hourlyLuck = parseHourlyLuck(html, luckyHours);

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

// 解析時辰吉凶資料
function parseHourlyLuck(html: string, defaultLuckyHours: string[]) {
  const hours = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const times = [
    '23:00-01:00', '01:00-03:00', '03:00-05:00', '05:00-07:00',
    '07:00-09:00', '09:00-11:00', '11:00-13:00', '13:00-15:00',
    '15:00-17:00', '17:00-19:00', '19:00-21:00', '21:00-23:00'
  ];

  // 簡化版：根據吉時清單判斷
  return hours.map((hour, index) => {
    const isLucky = defaultLuckyHours.includes(hour);
    
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
