// 農民曆服務 - 使用預設資料（不依賴爬蟲）

export interface RealAlmanacData {
  date: string;
  lunarDate: string;
  stemBranch: {
    year: string;
    month: string;
    day: string;
  };
  zodiac: string;
  solarTerm?: string;
  suitable: string[];
  unsuitable: string[];
  clash: string;
  direction: string;
  luckyGods: string[];
  unluckyGods: string[];
  directions: {
    joy: string;
    wealth: string;
    fortune: string;
  };
  fetalGod: string;
  luckyHours: string[];
  pengzu: string;
  hourlyLuck: HourlyLuck[];
}

export interface HourlyLuck {
  hour: string;
  time: string;
  suitable: string[];
  unsuitable: string[];
  clash: string;
  direction: string;
}

// 預設的農民曆資料對照表
const DEFAULT_ALMANAC_DATA: { [key: string]: Partial<RealAlmanacData> } = {
  '2026-02-02': {
    lunarDate: '十二月十五',
    stemBranch: { year: '乙巳蛇年', month: '己丑月', day: '丁未日' },
    zodiac: '蛇',
    solarTerm: '大寒',
    suitable: ['祭祀', '破屋', '壞垣'],
    unsuitable: ['齋醮', '嫁娶', '開市'],
    clash: '辛丑牛',
    direction: '西方',
    luckyGods: ['普護'],
    unluckyGods: ['月破', '大耗', '四擊', '九空'],
    directions: { joy: '正南', wealth: '西南', fortune: '東南' },
    fetalGod: '倉庫廁房內東',
    luckyHours: ['寅', '卯', '巳', '申', '戌', '亥'],
    pengzu: '丁不剃頭頭必生瘡；未不服藥毒氣入腸'
  },
  '2026-02-03': {
    lunarDate: '十二月十六',
    stemBranch: { year: '乙巳蛇年', month: '己丑月', day: '戊申日' },
    zodiac: '蛇',
    solarTerm: '大寒',
    suitable: ['納采', '訂盟', '祭祀', '祈福', '安機械', '移徙', '入宅'],
    unsuitable: ['開市', '安葬'],
    clash: '壬寅虎',
    direction: '南方',
    luckyGods: ['天德', '月德', '時德', '天巫'],
    unluckyGods: ['五虛', '土府'],
    directions: { joy: '東南', wealth: '正北', fortune: '東南' },
    fetalGod: '房床爐房內南',
    luckyHours: ['子', '丑', '卯', '午', '未', '酉'],
    pengzu: '戊不受田田主不祥；申不安床鬼祟入房'
  },
  '2026-02-04': {
    lunarDate: '十二月十七',
    stemBranch: { year: '乙巳蛇年', month: '庚寅月', day: '己酉日' },
    zodiac: '蛇',
    solarTerm: '立春',
    suitable: ['祭祀', '沐浴', '捕捉', '結網', '畋獵'],
    unsuitable: ['嫁娶', '入宅', '移徙', '安葬'],
    clash: '癸卯兔',
    direction: '東方',
    luckyGods: ['天恩', '母倉', '普護'],
    unluckyGods: ['月煞', '月虛', '月害'],
    directions: { joy: '正南', wealth: '正北', fortune: '正南' },
    fetalGod: '佔門雞棲房外東南',
    luckyHours: ['寅', '辰', '巳', '申', '戌'],
    pengzu: '己不破券二主並亡；酉不宴客醉坐顛狂'
  }
};

// 取得農民曆資料
export async function fetchRealAlmanac(date: string): Promise<RealAlmanacData> {
  console.log('📅 取得農民曆資料:', date);
  
  // 先檢查是否有預設資料
  const defaultData = DEFAULT_ALMANAC_DATA[date];
  
  if (defaultData) {
    console.log('✅ 使用預設農民曆資料');
    return {
      date,
      lunarDate: defaultData.lunarDate || '農曆日期',
      stemBranch: defaultData.stemBranch || { year: '年', month: '月', day: '日' },
      zodiac: defaultData.zodiac || '生肖',
      solarTerm: defaultData.solarTerm,
      suitable: defaultData.suitable || ['祭祀', '祈福'],
      unsuitable: defaultData.unsuitable || ['開市', '動土'],
      clash: defaultData.clash || '',
      direction: defaultData.direction || '',
      luckyGods: defaultData.luckyGods || [],
      unluckyGods: defaultData.unluckyGods || [],
      directions: defaultData.directions || { joy: '東方', wealth: '南方', fortune: '西方' },
      fetalGod: defaultData.fetalGod || '',
      luckyHours: defaultData.luckyHours || ['子', '丑', '寅'],
      pengzu: defaultData.pengzu || '',
      hourlyLuck: generateHourlyLuck(defaultData.luckyHours || [])
    };
  }
  
  // 如果沒有預設資料，生成通用資料
  console.log('⚠️ 無預設資料，使用通用模板');
  return generateGenericData(date);
}

// 生成通用農民曆資料
function generateGenericData(date: string): RealAlmanacData {
  const dateObj = new Date(date);
  const lunarDay = (dateObj.getDate() % 30) + 1;
  
  return {
    date,
    lunarDate: `農曆${convertToDayName(lunarDay)}`,
    stemBranch: { year: '乙巳蛇年', month: '己丑月', day: '日干支' },
    zodiac: '蛇',
    suitable: ['祭祀', '祈福', '出行', '納財'],
    unsuitable: ['開市', '動土', '破土'],
    clash: '沖煞',
    direction: '方位',
    luckyGods: ['天德', '月德'],
    unluckyGods: ['五鬼'],
    directions: { joy: '東方', wealth: '南方', fortune: '西方' },
    fetalGod: '胎神方位',
    luckyHours: ['子', '丑', '寅', '卯', '辰', '巳'],
    pengzu: '彭祖百忌',
    hourlyLuck: generateHourlyLuck(['子', '丑', '寅', '卯', '辰', '巳'])
  };
}

// 生成時辰吉凶
function generateHourlyLuck(luckyHours: string[]): HourlyLuck[] {
  const hours = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const times = [
    '23:00-01:00', '01:00-03:00', '03:00-05:00', '05:00-07:00',
    '07:00-09:00', '09:00-11:00', '11:00-13:00', '13:00-15:00',
    '15:00-17:00', '17:00-19:00', '19:00-21:00', '21:00-23:00'
  ];
  
  return hours.map((hour, index) => ({
    hour,
    time: times[index],
    suitable: luckyHours.includes(hour) ? ['祭祀', '祈福', '出行'] : [],
    unsuitable: luckyHours.includes(hour) ? [] : ['動土', '破土'],
    clash: '',
    direction: ''
  }));
}

// 轉換日期為中文
function convertToDayName(day: number): string {
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  
  const ones = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  
  if (day < 10) return '初' + ones[day];
  if (day < 20) return '十' + ones[day - 10];
  if (day < 30) return '廿' + ones[day - 20];
  return '三十';
}
