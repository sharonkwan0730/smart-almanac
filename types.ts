
export interface TibetanData {
  date: string;
  yearName: string;
  weekday: string;
  constellation: string;
  yoga: string;
  analysis: string;
  auspicious: string[];
  inauspicious: string[];
  specialDay?: string;
  buddhaDay?: string; 
  // 藏傳佛教徒專屬欄位
  dharmaAdvice: string; // 當日修行法門建議 (例如：蓮師薈供、度母修法、煙供等)
  traditionalActivities: {
    haircut: string; // 剪髮吉凶與後果說明
    windHorse: string; // 懸掛風馬旗/放天馬的適宜度
    other: string[]; // 其他傳統活動 (如：放生、供燈)
  };
  meritMultiplier?: string; // 功德倍數說明 (例如：10萬倍、億倍)
}

export interface SpiritDirections {
  wealth: string;
  joy: string;
}

export interface AlmanacData {
  solarDate: string;
  lunarDate: string;
  solarTerm?: string;
  tibetanData: TibetanData;
  stemBranch: string;
  zodiac: string;
  fiveElements: string;
  auspicious: string[];
  inauspicious: string[];
  clashZodiac: string;
  spiritDirections: SpiritDirections;
  fetalSpirit: string;
  pengZuTaboo: string;
  luckySpirits: string[];
  unluckySpirits: string[];
  dailyAdvice: string;
  hourlyLuck: HourlyLuck[];
}

export interface HourlyLuck {
  hour: string;
  period: string;
  status: string;
  description: string;
}

export interface DateRecommendation {
  date: string;
  lunarDate: string;
  reason: string;
  rating: number;
}

export interface ZodiacFortune {
  zodiac: string;
  daily: {
    overall: string;
    wealth: string;
    love: string;
    career: string;
    score: number;
  };
  monthly: string;
  elementAnalysis: string; 
}

export enum EventType {
  MARRIAGE = '結婚',
  MOVING = '搬家',
  OPENING = '開業',
  TRAVEL = '出行',
  RENOVATION = '裝修',
  SIGNING = '簽約'
}

export const ZODIAC_LIST = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'] as const;
export type ZodiacType = typeof ZODIAC_LIST[number];
