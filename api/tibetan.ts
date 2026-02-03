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

  try {
    const [year, month, day] = date.split('-').map(Number);
    
    // 爬取該年的藏曆資料
    const response = await fetch(`https://zangli.pro/calendar/${year}.html`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const data = parseTibetanCalendar(html, year, month, day);

    return res.status(200).json(data);

  } catch (error: any) {
    console.error(`❌ 藏曆爬取失敗:`, error.message);
    return res.status(500).json({ 
      error: '無法取得藏曆資料',
      message: error.message 
    });
  }
}

function parseTibetanCalendar(html: string, year: number, month: number, day: number) {
  // 清理 HTML
  const cleanHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  // 建立搜尋模式：找到對應日期的資料
  // 格式類似: "3  十五  阿弥陀佛节日  作何善恶成百万倍"
  const dayStr = day.toString();
  
  // 尋找該日期的藏曆資訊
  const patterns = [
    // 格式: "日期 藏曆日 節日 功德"
    new RegExp(`\\|\\s*${dayStr}\\s+([^|]+?)(?=\\s*\\|)`, 'g'),
    new RegExp(`${dayStr}\\s+(初[一二三四五六七八九十]+|十[一二三四五六七八九]?|廿[一二三四五六七八九]?|三十|[一二三四五六七八九十]+)\\s*([^|]*?)(?=\\d|$)`, 'g')
  ];

  let tibetanDay = '';
  let buddhaDay = '';
  let merit = '';
  let specialEvent = '';

  // 找月份區塊
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const monthHeader = `${year}年${month}月`;
  
  // 在 HTML 中找到對應月份的區塊
  const monthIndex = html.indexOf(monthHeader);
  let nextMonthIndex = html.length;
  
  if (month < 12) {
    const nextMonth = `${year}年${month + 1}月`;
    const idx = html.indexOf(nextMonth);
    if (idx > monthIndex) nextMonthIndex = idx;
  }

  const monthSection = html.substring(monthIndex, nextMonthIndex);
  
  // 在月份區塊中找對應日期
  // 格式: | 3  十五  阿弥陀佛节日  作何善恶成百万倍 |
  const dayPattern = new RegExp(
    `\\b${dayStr}\\s+((?:初[一二三四五六七八九十]+|十[一二三四五六七八九]?|廿[一二三四五六七八九]?|三十|闰?[一二三四五六七八九十廿]+)[^|]*?)(?=\\||\\d{1,2}\\s|$)`,
    'i'
  );
  
  const match = monthSection.match(dayPattern);
  
  if (match) {
    const content = match[1].trim();
    
    // 解析藏曆日
    const dayMatch = content.match(/^(闰)?(初[一二三四五六七八九十]+|十[一二三四五六七八九]?|廿[一二三四五六七八九]?|三十|[一二三四五六七八九十廿]+)/);
    if (dayMatch) {
      tibetanDay = (dayMatch[1] || '') + dayMatch[2];
    }

    // 解析佛菩薩節日
    const buddhaPatterns = [
      /阿弥陀佛节日/,
      /药师佛节日/,
      /释迦牟尼佛节日/,
      /释迦牟尼佛\s*成道日涅槃日/,
      /释迦牟尼佛\s*初转法轮日/,
      /释迦牟尼佛\s*天降日/,
      /释迦牟尼佛\s*入胎日/,
      /释迦牟尼佛诞辰/,
      /观音菩萨节日/,
      /地藏王菩萨节日/,
      /莲师荟供日/,
      /空行母荟供日/,
      /禅定胜王佛节日/,
      /神变节/
    ];

    const foundBuddha: string[] = [];
    for (const pattern of buddhaPatterns) {
      if (pattern.test(content)) {
        const m = content.match(pattern);
        if (m) foundBuddha.push(m[0]);
      }
    }
    
    if (foundBuddha.length > 0) {
      // 轉換為繁體
      buddhaDay = foundBuddha.map(s => 
        s.replace(/阿弥陀佛/g, '阿彌陀佛')
         .replace(/药师佛/g, '藥師佛')
         .replace(/释迦牟尼佛/g, '釋迦牟尼佛')
         .replace(/观音菩萨/g, '觀音菩薩')
         .replace(/地藏王菩萨/g, '地藏王菩薩')
         .replace(/莲师荟供日/g, '蓮師薈供日')
         .replace(/空行母荟供日/g, '空行母薈供日')
         .replace(/禅定胜王佛/g, '禪定勝王佛')
         .replace(/节日/g, '節日')
         .replace(/神变节/g, '神變節')
         .replace(/成道日涅槃日/g, '成道日、涅槃日')
         .replace(/初转法轮日/g, '初轉法輪日')
         .replace(/天降日/g, '天降日')
         .replace(/入胎日/g, '入胎日')
         .replace(/诞辰/g, '誕辰')
      ).join('、');
    }

    // 解析功德倍數
    const meritMatch = content.match(/作何善[恶惡]成(.+?倍)/);
    if (meritMatch) {
      merit = meritMatch[1]
        .replace(/万/g, '萬')
        .replace(/亿/g, '億');
    }

    // 解析特殊事件（日食、月食等）
    const eclipseMatch = content.match(/(日环食|日全食|月全食|月偏食)[^|]*/);
    if (eclipseMatch) {
      specialEvent = eclipseMatch[0]
        .replace(/日环食/g, '日環食')
        .replace(/食甚/g, '食甚');
    }

    // 檢查是否為月圓日（十五）或布薩日（初八、十五、廿三、三十）
    const isFullMoon = /十五/.test(tibetanDay);
    const isUposatha = /初八|十五|廿三|三十/.test(tibetanDay);
    
    // 組合額外標籤
    const extraTags: string[] = [];
    if (isFullMoon) extraTags.push('月圓日');
    if (isUposatha) extraTags.push('布薩日');
    
    if (extraTags.length > 0 && buddhaDay) {
      buddhaDay = buddhaDay + '、' + extraTags.join('、');
    } else if (extraTags.length > 0) {
      buddhaDay = extraTags.join('、');
    }
  }

  // 解析藏曆年月（從整個頁面找）
  const yearMatch = html.match(/\*\*(火马年|木蛇年|木龙年|土猴年|火羊年)\s*(正月|[一二三四五六七八九十]+月|闰[一二三四五六七八九十]+月)\*\*/);
  let tibetanYear = '';
  let tibetanMonth = '';
  
  if (yearMatch) {
    tibetanYear = yearMatch[1]
      .replace(/火马年/g, '火馬年')
      .replace(/木龙年/g, '木龍年');
    tibetanMonth = yearMatch[2];
  }

  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    tibetanYear,
    tibetanMonth,
    tibetanDay,
    buddhaDay: buddhaDay || null,
    merit: merit || null,
    specialEvent: specialEvent || null
  };
}
