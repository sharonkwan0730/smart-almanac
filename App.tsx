
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ... } from './services/geminiService';
import { AlmanacData, DateRecommendation, EventType, ZodiacFortune, ZodiacType, ZODIAC_LIST } from './types';
import { AlmanacCard } from './components/AlmanacCard';

const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [tempDate, setTempDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [almanacData, setAlmanacData] = useState<AlmanacData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'search' | 'zodiac' | 'memo'>('daily');
  const [errorType, setErrorType] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);
  const [loadingTime, setLoadingTime] = useState<number>(0);
  
  const [allMemos, setAllMemos] = useState<Record<string, string>>({});
  const [currentMemo, setCurrentMemo] = useState<string>("");

  const [searchEvent, setSearchEvent] = useState<EventType>(EventType.MARRIAGE);
  const [searchMonth, setSearchMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [recommendations, setRecommendations] = useState<DateRecommendation[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  const [userZodiac, setUserZodiac] = useState<ZodiacType>(ZODIAC_LIST[0]);
  const [zodiacFortune, setZodiacFortune] = useState<ZodiacFortune | null>(null);
  const [zodiacLoading, setZodiacLoading] = useState<boolean>(false);

  const isFetchingRef = useRef(false);
  const loadingTimerRef = useRef<number | null>(null);

  // 初始化記事本
  useEffect(() => {
    try {
      const saved = localStorage.getItem('almanac_memos');
      if (saved) setAllMemos(JSON.parse(saved));
    } catch (e) { console.warn("localStorage 不可用或資料損壞"); }
  }, []);

  useEffect(() => {
    setCurrentMemo(allMemos[selectedDate] || "");
  }, [selectedDate, allMemos]);

  // 配額冷卻計時器
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => setCooldown(prev => Math.max(0, prev - 1)), 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  // 加載時間監控 (解決手機跑不出來沒反應的問題)
  useEffect(() => {
    if (loading) {
      const start = Date.now();
      loadingTimerRef.current = window.setInterval(() => {
        setLoadingTime(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      setLoadingTime(0);
    }
    return () => { if (loadingTimerRef.current) clearInterval(loadingTimerRef.current); };
  }, [loading]);

  const saveMemo = (text: string) => {
    const updated = { ...allMemos, [selectedDate]: text };
    if (!text) delete updated[selectedDate];
    setAllMemos(updated);
    try {
      localStorage.setItem('almanac_memos', JSON.stringify(updated));
    } catch (e) { /* 靜默失敗 */ }
  };

  const fetchAlmanac = useCallback(async (date: string, forceRefresh = false) => {
    const cacheKey = `almanac_cache_v5_${date}`;
    
    // 優先檢查快取
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setAlmanacData(JSON.parse(cached));
          setLoading(false);
          setErrorType(null);
          return; 
        }
      } catch (e) { /* 快取讀取失敗則繼續請求 */ }
    }

    if (isFetchingRef.current || (cooldown > 0 && !forceRefresh)) return;
    
    isFetchingRef.current = true;
    setLoading(true);
    setErrorType(null);
    
    try {
      const data = await getAlmanacForDate(date, forceRefresh);
      setAlmanacData(data);
    } catch (err: any) {
      console.error("Fetch Error:", err.message);
      setErrorType(err.message);
      if (err.message === "QUOTA_EXCEEDED") setCooldown(45); // 手機端冷卻時間稍長以保險
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [cooldown]);

  // 手機端去抖動時間稍長 (350ms)，避免快速滑動日期導致重複請求
  useEffect(() => {
    const timer = setTimeout(() => { 
      if (selectedDate !== almanacData?.solarDate) {
        fetchAlmanac(selectedDate); 
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [selectedDate, fetchAlmanac, almanacData]);

  const handleQuery = (force = false) => {
    fetchAlmanac(selectedDate, force);
  };

  const adjustDate = (days: number) => {
    const d = new Date(tempDate);
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().split('T')[0];
    setTempDate(newDate);
    setSelectedDate(newDate); 
  };

  const jumpToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setTempDate(today);
    setSelectedDate(today);
  };

  const fetchZodiacFortune = async () => {
    if (zodiacLoading || cooldown > 0) return;
    setZodiacLoading(true);
    setErrorType(null);
    try {
      const fortune = await getZodiacFortune(userZodiac, selectedDate);
      setZodiacFortune(fortune);
    } catch (e: any) { 
      setErrorType(e.message);
      if (e.message === "QUOTA_EXCEEDED") setCooldown(30);
    } finally { 
      setZodiacLoading(false); 
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchLoading || cooldown > 0) return;
    setSearchLoading(true);
    setErrorType(null);
    try {
      const results = await findLuckyDates(searchEvent, searchMonth);
      setRecommendations(results);
    } catch (e: any) { 
      setErrorType(e.message);
      if (e.message === "QUOTA_EXCEEDED") setCooldown(30);
    } finally { 
      setSearchLoading(false); 
    }
  };

  const Skeleton = ({ className = "h-4 w-full" }: { className?: string }) => (
    <div className={`bg-stone-100 animate-pulse rounded ${className}`}></div>
  );

  const getDayOfWeek = (dateStr: string) => {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return days[new Date(dateStr).getDay()];
  };

  const renderErrorMessage = () => {
    if (!errorType && cooldown === 0 && loadingTime < 15) return null;
    
    let message = "曆法演算同步中，請稍後重試...";
    let subMessage = "";

    if (loadingTime >= 15 && loading) {
      message = "網路連線似乎較慢...";
      subMessage = "（建議檢查手機網路，或點擊下方按鈕強制重新連通。）";
    } else if (errorType === "QUOTA_EXCEEDED" || cooldown > 0) {
      message = "太乙神數感應頻繁，需稍作平息。";
      subMessage = cooldown > 0 
        ? `（請等待 ${cooldown} 秒後再試。頻繁操作會觸發系統保護。）`
        : "（API 流量已達上限，請稍候重試。）";
    } else if (errorType === "INVALID_KEY") {
      message = "密鑰驗證失敗。";
      subMessage = "（後端連線配置異常，請聯繫管理員。）";
    }

    return (
      <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl text-center shadow-inner mb-6 animate-pulse mx-auto max-w-lg">
        <div className="text-3xl mb-3">{cooldown > 0 ? '⌛' : '📡'}</div>
        <p className="text-stone-900 font-serif font-black text-lg mb-2">{message}</p>
        <p className="text-stone-500 text-xs font-medium leading-relaxed mb-4">{subMessage}</p>
        <button onClick={() => handleQuery(true)} className="bg-red-900 text-white px-8 py-2.5 rounded-xl text-xs font-black tracking-widest hover:bg-red-800 transition-all shadow-md active:scale-95">
          強制重新讀取
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-paper pb-12">
      <header className="relative bg-red-900 py-6 md:py-8 px-4 overflow-hidden shadow-md border-b-4 border-amber-600 text-white">
        <div className="absolute inset-0 bg-pattern opacity-5"></div>
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1 className="text-xl md:text-4xl font-serif font-black tracking-[0.2em] md:tracking-[0.3em] mb-1 drop-shadow-sm">智選良辰</h1>
          <p className="text-amber-200 text-[8px] md:text-[9px] font-medium tracking-[0.4em] md:tracking-[0.5em] uppercase opacity-80">太乙神數 • 漢藏智慧對照</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 md:px-4 -mt-4 md:-mt-6 relative z-20">
        <nav className="flex justify-center mb-6 overflow-x-auto custom-scrollbar pb-2">
          <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-stone-200 flex gap-1 shrink-0">
            {[
              { id: 'daily', label: '每日宜忌', icon: '🗓️' },
              { id: 'zodiac', label: '生肖運勢', icon: '✨' },
              { id: 'search', label: '吉日查詢', icon: '🔍' },
              { id: 'memo', label: '大事記事', icon: '📝' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 md:px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-red-900 text-white shadow-sm' : 'text-stone-500'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-h-[500px]">
          {renderErrorMessage()}

          {activeTab === 'daily' && (
            <div className="space-y-6 animate-slide-up">
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-3xl shadow-xl border-t-8 border-red-900 overflow-hidden">
                  <div className="flex items-center justify-between bg-stone-50 border-b border-stone-200 px-1">
                     <button onClick={() => adjustDate(-1)} className="p-4 md:p-6 text-stone-400 hover:text-red-900 transition-all font-black hover:scale-125 active:bg-stone-100 rounded-full">❮</button>
                     <div className="flex-grow flex flex-col items-center py-4">
                        <div className="flex items-center gap-2 md:gap-4 mb-2">
                           <button onClick={jumpToToday} className="text-[9px] font-black px-3 py-1 bg-red-50 text-red-900 rounded-full border border-red-100 hover:bg-red-100 transition-all uppercase tracking-tighter">TODAY</button>
                           <span className="text-stone-300 font-serif">|</span>
                           <span className="text-stone-500 text-[10px] font-bold tracking-widest">{getDayOfWeek(tempDate)}</span>
                        </div>
                        <div className="relative group flex items-center">
                          <input 
                            type="date" 
                            value={tempDate}
                            onChange={(e) => { 
                              setTempDate(e.target.value); 
                              setSelectedDate(e.target.value); 
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <h2 className="text-2xl md:text-5xl font-serif font-black text-stone-800 tracking-tighter transition-colors group-active:text-red-900">
                            {tempDate.split('-').join(' . ')}
                          </h2>
                          <span className="ml-2 text-stone-300 text-sm group-active:animate-bounce">▼</span>
                        </div>
                     </div>
                     <button onClick={() => adjustDate(1)} className="p-4 md:p-6 text-stone-400 hover:text-red-900 transition-all font-black hover:scale-125 active:bg-stone-100 rounded-full">❯</button>
                  </div>
                  
                  {loading && (
                    <div className="h-1 w-full bg-stone-100 overflow-hidden">
                      <div className="h-full bg-red-900 animate-loading-bar"></div>
                    </div>
                  )}
                </div>
              </div>

              {!errorType && cooldown === 0 && (
                <div className={`grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 transition-opacity duration-300 ${loading && !almanacData ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                  <div className="lg:col-span-3 space-y-4 md:space-y-6">
                    <section className="bg-white rounded-2xl shadow-md overflow-hidden border border-stone-200">
                      <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-center bg-stone-50/30">
                        <div className="text-center md:text-left md:border-r border-stone-100 md:pr-6">
                          <div className="inline-block bg-red-100 text-red-800 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase mb-1">農曆 LUNAR</div>
                          <h2 className="text-2xl md:text-3xl font-serif font-black text-stone-800">
                            {almanacData?.lunarDate || '讀取中...'}
                          </h2>
                          {almanacData?.solarTerm && <span className="mt-2 inline-block bg-amber-500 text-white px-3 py-1 rounded text-xs font-bold shadow-sm">{almanacData.solarTerm}</span>}
                        </div>
                        <div className="text-center md:text-left">
                          <div className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase mb-1">藏曆 TIBETAN</div>
                          <p className="text-base md:text-lg font-serif font-bold text-stone-700 italic">
                            {almanacData?.tibetanData?.yearName} {almanacData?.tibetanData?.date}
                          </p>
                          {almanacData?.tibetanData?.meritMultiplier && (
                            <span className="mt-1 inline-block bg-red-800 text-amber-200 px-3 py-0.5 rounded-full text-[9px] font-black">
                              ★ {almanacData.tibetanData.meritMultiplier}
                            </span>
                          )}
                        </div>
                      </div>
                    </section>

                    <AlmanacCard title="金剛乘修行指南 (Vajrayana Guidance)" icon="☸️">
                      {almanacData ? (
                        <div className="space-y-4 md:space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-amber-50/50 p-3 md:p-4 rounded-xl border border-amber-100/50">
                              <span className="text-[9px] font-black text-amber-800 block mb-1 uppercase tracking-widest">剪髮吉凶</span>
                              <p className="text-xs md:text-sm font-serif font-bold text-stone-800 leading-relaxed italic">
                                {almanacData.tibetanData.traditionalActivities.haircut}
                              </p>
                            </div>
                            <div className="bg-blue-50/50 p-3 md:p-4 rounded-xl border border-blue-100/50">
                              <span className="text-[9px] font-black text-blue-800 block mb-1 uppercase tracking-widest">懸掛經幡</span>
                              <p className="text-xs md:text-sm font-serif font-bold text-stone-800 leading-relaxed italic">
                                {almanacData.tibetanData.traditionalActivities.windHorse}
                              </p>
                            </div>
                          </div>

                          <div className="bg-red-900 p-4 md:p-6 rounded-2xl border-2 border-amber-500/20 shadow-lg relative">
                            <div className="text-amber-100 space-y-3">
                              <p className="text-xs font-black tracking-[0.2em] text-amber-500/80 uppercase">修行導引 Practice Advice</p>
                              <p className="text-sm md:text-base font-serif font-bold leading-relaxed italic">
                                {almanacData.tibetanData.dharmaAdvice}
                              </p>
                            </div>
                          </div>

                          <div className="bg-stone-50 p-5 md:p-6 rounded-2xl border border-stone-200">
                            <p className="text-[9px] font-black text-stone-400 mb-3 uppercase tracking-[0.3em]">星度解析 Analysis</p>
                            <div className="space-y-3">
                              {almanacData.tibetanData.analysis.split('\n').filter(p => p.trim()).map((para, idx) => (
                                <p key={idx} className="text-xs md:text-sm font-serif font-bold text-stone-700 leading-relaxed italic">
                                  {para}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : <Skeleton className="h-64" />}
                    </AlmanacCard>

                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-100">
                        <div className="p-4 md:p-6 bg-emerald-50/10">
                          <h3 className="text-emerald-900 font-serif font-black text-sm mb-3">漢傳宜事</h3>
                          <div className="flex flex-wrap gap-1.5">{almanacData?.auspicious.map((item, i) => <span key={i} className="bg-white text-emerald-900 px-2 py-1 rounded text-[10px] font-bold border border-emerald-100">{item}</span>)}</div>
                        </div>
                        <div className="p-4 md:p-6 bg-rose-50/10">
                          <h3 className="text-rose-900 font-serif font-black text-sm mb-3">漢傳忌事</h3>
                          <div className="flex flex-wrap gap-1.5">{almanacData?.inauspicious.map((item, i) => <span key={i} className="bg-white text-rose-900 px-2 py-1 rounded text-[10px] font-bold border border-rose-100">{item}</span>)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-1 space-y-4 md:space-y-6">
                    <div className="bg-red-900 text-white p-4 rounded-2xl shadow-md text-center">
                      <span className="text-amber-400 font-bold text-[8px] tracking-widest uppercase mb-1 block">今日值日</span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl font-serif font-black">{almanacData?.zodiac || '--'}</span>
                        <div className="text-left border-l border-white/20 pl-2">
                          <div className="text-[10px] font-bold">{almanacData?.stemBranch || '---'}</div>
                          <div className="text-[8px] opacity-60">{almanacData?.fiveElements || '---'}</div>
                        </div>
                      </div>
                    </div>

                    <AlmanacCard title="神煞與方位" icon="🧭">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-stone-50 rounded-lg text-center">
                            <span className="block text-[8px] text-stone-400 uppercase font-bold">財神</span>
                            <span className="text-sm font-serif font-black text-stone-800">{almanacData?.spiritDirections?.wealth || '--'}</span>
                          </div>
                          <div className="p-2 bg-stone-50 rounded-lg text-center">
                            <span className="block text-[8px] text-stone-400 uppercase font-bold">喜神</span>
                            <span className="text-sm font-serif font-black text-stone-800">{almanacData?.spiritDirections?.joy || '--'}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-stone-500 italic bg-stone-50 p-3 rounded-lg border border-stone-100">
                          <span className="font-bold text-red-800 block mb-1">沖煞提醒：</span>
                          {almanacData?.clashZodiac}
                        </div>
                      </div>
                    </AlmanacCard>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'zodiac' && (
            <div className="space-y-6 animate-slide-up max-w-4xl mx-auto">
              <section className="bg-white p-5 md:p-8 rounded-2xl shadow-sm text-center border border-stone-200">
                <h2 className="text-lg font-serif font-black text-stone-800 mb-6">生肖運勢演算</h2>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2 mb-8">
                  {ZODIAC_LIST.map(z => (
                    <button
                      key={z}
                      onClick={() => setUserZodiac(z)}
                      className={`aspect-square rounded-xl flex items-center justify-center text-lg font-bold transition-all ${userZodiac === z ? 'bg-red-900 text-white shadow-md' : 'bg-stone-50 text-stone-300'}`}
                    >
                      {z}
                    </button>
                  ))}
                </div>
                <button onClick={fetchZodiacFortune} disabled={zodiacLoading || cooldown > 0} className="w-full md:w-auto bg-stone-900 text-white px-12 py-3 rounded-xl font-bold text-sm tracking-widest active:scale-95 disabled:opacity-30">
                  {zodiacLoading ? '演算中...' : (cooldown > 0 ? `冷卻中 ${cooldown}s` : `讀取 [${userZodiac}] 運勢`)}
                </button>
              </section>

              {zodiacFortune && (
                <div className="animate-slide-up">
                   <AlmanacCard title={`${userZodiac} 生肖日評`} icon="✨">
                     <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="text-center md:border-r border-stone-100 md:pr-8">
                           <span className="text-5xl font-serif font-black text-red-900">{zodiacFortune.daily.score}</span>
                           <span className="block text-[8px] text-stone-400 font-black mt-1 uppercase tracking-widest">能量指標</span>
                        </div>
                        <div className="flex-grow space-y-4 text-center md:text-left">
                           <p className="text-lg font-serif font-black text-stone-800 italic">「{zodiacFortune.daily.overall}」</p>
                           <p className="text-xs md:text-sm text-stone-600 leading-relaxed font-serif italic">{zodiacFortune.elementAnalysis}</p>
                        </div>
                     </div>
                   </AlmanacCard>
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-6 animate-slide-up max-w-4xl mx-auto">
              <section className="bg-stone-900 text-white p-6 md:p-8 rounded-2xl shadow-lg">
                <h2 className="text-lg font-serif font-black mb-6 text-center tracking-widest">擇吉日 • 定大事</h2>
                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-amber-500 text-[9px] font-black uppercase tracking-widest">事項</label>
                        <select value={searchEvent} onChange={(e) => setSearchEvent(e.target.value as EventType)} className="w-full bg-stone-800 rounded-xl py-3 px-4 text-sm font-bold outline-none text-amber-200">
                          {Object.values(EventType).map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-amber-500 text-[9px] font-black uppercase tracking-widest">月份</label>
                        <input type="month" value={searchMonth} onChange={(e) => setSearchMonth(e.target.value)} className="w-full bg-stone-800 rounded-xl py-3 px-4 text-sm font-bold outline-none text-white" />
                      </div>
                   </div>
                   <button type="submit" disabled={searchLoading || cooldown > 0} className="mt-2 bg-amber-500 text-stone-900 font-black py-3 rounded-xl text-sm shadow active:scale-95 disabled:opacity-50">
                      {searchLoading ? '演算中...' : '深度擇日'}
                   </button>
                </form>
              </section>

              {recommendations.length > 0 && (
                <div className="grid gap-3">
                   {recommendations.map((rec, i) => (
                      <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex items-center gap-4 active:bg-stone-50"
                           onClick={() => { setTempDate(rec.date); setSelectedDate(rec.date); setActiveTab('daily'); }}>
                         <div className="border-r border-stone-100 pr-4 min-w-[70px] text-center">
                            <p className="text-lg font-serif font-black text-red-900">{rec.date.split('-').slice(1).join('/')}</p>
                            <p className="text-stone-400 font-bold text-[8px] tracking-tighter">{rec.lunarDate}</p>
                         </div>
                         <div className="flex-grow"><p className="text-xs md:text-sm font-serif font-bold text-stone-800 italic line-clamp-2">「{rec.reason}」</p></div>
                         <div className="hidden sm:flex text-amber-500 text-xs">{'★'.repeat(rec.rating)}</div>
                      </div>
                   ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'memo' && (
            <div className="animate-slide-up max-w-4xl mx-auto">
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-stone-200">
                <h2 className="text-lg font-serif font-black text-stone-800 mb-6 text-center border-b border-stone-50 pb-4">記事檔案庫</h2>
                {Object.keys(allMemos).length === 0 ? (
                  <div className="py-12 text-center text-stone-300 font-serif italic text-sm">尚無記事記錄</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(allMemos).sort((a,b) => b[0].localeCompare(a[0])).map(([date, memo]) => (
                      <div key={date} onClick={() => { setTempDate(date); setSelectedDate(date); setActiveTab('daily'); }} className="bg-stone-50 p-4 rounded-xl border border-stone-100 active:border-red-800">
                         <span className="font-serif font-black text-red-900 text-xs mb-1 block">{date}</span>
                         <p className="text-stone-600 text-[11px] leading-relaxed line-clamp-3 italic">{memo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 text-center text-stone-300 text-[8px] tracking-[0.5em] uppercase px-4">
        © 智選良辰 • 曆法對照系統
      </footer>
    </div>
  );
};

export default App;
