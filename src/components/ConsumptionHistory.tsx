import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, Calendar, Zap, AlertCircle, Sparkles, RefreshCw, Layers, Check, Plus, ShoppingBag
} from 'lucide-react';

interface ChartDataItem {
  day: string;
  date: string;
  'Thịt cá': number;
  'Rau củ quả': number;
  'Sữa & Trứng': number;
  'Gia vị & Khác': number;
  'Tổng cộng': number;
}

interface RawLog {
  id: number;
  ingredient_name: string;
  category: string;
  quantity: string;
  date_consumed: string;
}

export default function ConsumptionHistory() {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [rawLogs, setRawLogs] = useState<RawLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  
  // Chart Lines Visibility Toggles
  const [showMeats, setShowMeats] = useState(true);
  const [showVeggies, setShowVeggies] = useState(true);
  const [showDairy, setShowDairy] = useState(true);
  const [showOthers, setShowOthers] = useState(true);
  const [showTotal, setShowTotal] = useState(false);

  // Manual Add Log Form Toggles
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('Veggies');
  const [manualQuantity, setManualQuantity] = useState('');

  // AI Purchase Forecast States
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastText, setForecastText] = useState<string | null>(null);
  const [predictedIngredients, setPredictedIngredients] = useState<any[]>([]);
  const [selectedForecastItems, setSelectedForecastItems] = useState<{ [key: string]: boolean }>({});
  const [addSuccess, setAddSuccess] = useState(false);

  const generateForecast = async () => {
    try {
      setForecastLoading(true);
      setForecastText(null);
      setAddSuccess(false);
      setPredictedIngredients([]);
      const res = await fetch('/api/consumption-forecast', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setForecastText(data.forecastText);
          setPredictedIngredients(data.predictedIngredients || []);
          
          // Select all predicted items by default
          const initialSelection: { [key: string]: boolean } = {};
          (data.predictedIngredients || []).forEach((item: any, index: number) => {
            initialSelection[`${item.name}-${index}`] = true;
          });
          setSelectedForecastItems(initialSelection);
        }
      }
    } catch (e) {
      console.error('Failed to generate shopping forecast:', e);
      setForecastText('Không thể kết nối với trí tuệ nhân tạo Gemini để lập dự báo lúc này.');
    } finally {
      setForecastLoading(false);
    }
  };

  const toggleForecastItemSelection = (key: string) => {
    setSelectedForecastItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleAddSelectedToShopping = async () => {
    const itemsToAdd = predictedIngredients.filter((item, idx) => selectedForecastItems[`${item.name}-${idx}`]);
    if (itemsToAdd.length === 0) return;

    try {
      const payload = itemsToAdd.map(item => ({
        name: `${item.name} (${item.quantity})`,
        category: item.category || 'Produce',
        quantity: item.quantity || '1 unit'
      }));

      const res = await fetch('/api/shopping-list/add-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });

      if (res.ok) {
        setAddSuccess(true);
        setTimeout(() => setAddSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save forecast items:', e);
    }
  };

  const [historyDays, setHistoryDays] = useState<number>(7);

  const fetchHistory = async (daysVal = historyDays) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/consumption-history?days=${daysVal}`);
      if (res.ok) {
        const data = await res.json();
        if (data.chartData) setChartData(data.chartData);
        if (data.rawLogs) setRawLogs(data.rawLogs);
      }
    } catch (e) {
      console.error('Failed to load consumption history:', e);
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsights = async () => {
    try {
      setInsightsLoading(true);
      setAiReport(null);
      const res = await fetch('/api/consumption-insights', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAiReport(data.insights);
      }
    } catch (e) {
      console.error('Failed to generate AI insights:', e);
      setAiReport('Đã xảy ra lỗi khi kết nối với máy chủ AI. Vui lòng thử lại sau.');
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleManualLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualQuantity.trim()) return;

    try {
      const res = await fetch('/api/consumption/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualName.trim(),
          category: manualCategory,
          quantity: manualQuantity.trim()
        })
      });
      if (res.ok) {
        setManualName('');
        setManualQuantity('');
        setShowManualForm(false);
        // Refresh chart & list
        await fetchHistory();
      }
    } catch (err) {
      console.error('Failed to save manual log:', err);
    }
  };

  // Compute stat metrics based on the history
  const totalThisWeek = rawLogs.length;
  const peakDay = chartData.reduce((prev, current) => 
    (prev['Tổng cộng'] > current['Tổng cộng']) ? prev : current, 
    { day: 'Chưa có', 'Tổng cộng': 0 }
  );

  // Category proportions this week
  let meatCount = 0;
  let veggieCount = 0;
  let dairyCount = 0;
  let otherCount = 0;

  rawLogs.forEach(l => {
    const cat = l.category.toLowerCase();
    if (cat === 'meats') meatCount++;
    else if (cat === 'veggies' || cat === 'produce') veggieCount++;
    else if (cat === 'dairy') dairyCount++;
    else otherCount++;
  });

  const getFavoriteCategory = () => {
    const maxVal = Math.max(meatCount, veggieCount, dairyCount, otherCount);
    if (maxVal === 0) return 'Chưa ghi nhận';
    if (maxVal === veggieCount) return 'Rau củ quả sạch';
    if (maxVal === meatCount) return 'Đạm tươi ngon (Thịt/Cá)';
    if (maxVal === dairyCount) return 'Sữa & Trứng';
    return 'Gia vị & Khác';
  };

  useEffect(() => {
    fetchHistory(historyDays);
  }, [historyDays]);

  // Simple custom parser for Gemini Response markdown
  const renderFormattedReport = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-2"></div>;

      // Header parsing
      if (trimmed.startsWith('### ')) {
        return <h4 key={idx} className="font-extrabold text-xs text-zinc-900 uppercase tracking-wider mt-4 mb-2">{trimmed.replace('### ', '')}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={idx} className="font-extrabold text-sm text-zinc-900 border-b border-zinc-100 pb-1 mt-4 mb-2 flex items-center gap-2">{trimmed.replace('## ', '')}</h3>;
      }
      if (trimmed.startsWith('# ')) {
        return <h2 key={idx} className="font-bold text-base text-zinc-900 mt-5 mb-2">{trimmed.replace('# ', '')}</h2>;
      }

      // Bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2);
        return (
          <div key={idx} className="flex items-start gap-1.5 pl-2 py-0.5 text-zinc-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
            <span className="leading-relaxed">{parseBoldSpan(content)}</span>
          </div>
        );
      }

      // Normal text with potential **bolding**
      return (
        <p key={idx} className="text-zinc-600 leading-relaxed py-1">
          {parseBoldSpan(line)}
        </p>
      );
    });
  };

  // Helper to find and parse **some text** into high contrast bold tags
  const parseBoldSpan = (inputText: string) => {
    const parts = inputText.split(/\*\*([^*]+)\*\*/g);
    if (parts.length === 1) return inputText;

    return parts.map((part, i) => (
      i % 2 === 1 ? <strong key={i} className="font-black text-zinc-800">{part}</strong> : part
    ));
  };

  // Group logs by date
  const groupedLogs = rawLogs.reduce<{ [date: string]: RawLog[] }>((groups, log) => {
    const date = log.date_consumed || 'Không rõ ngày';
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {});

  // Sort dates descending so newest logs are first
  const sortedDates = Object.keys(groupedLogs).sort((a, b) => {
    try {
      const timeB = new Date(b).getTime();
      const timeA = new Date(a).getTime();
      if (isNaN(timeB) || isNaN(timeA)) return b.localeCompare(a);
      return timeB - timeA;
    } catch {
      return b.localeCompare(a);
    }
  });

  const formatFriendlyDate = (dateStr: string) => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (dateStr === todayStr) {
        return 'Hôm nay';
      } else if (dateStr === yesterdayStr) {
        return 'Hôm qua';
      }

      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `Ngày ${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      
      {/* Visual Header */}
      <section className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex justify-between items-center">
        <div>
          <h2 className="text-[10px] font-black tracking-widest text-zinc-400 font-mono uppercase">CHỈ SỐ TIÊU THỤ {historyDays} NGÀY</h2>
          <h1 className="text-xl font-black text-zinc-900 tracking-tight mt-1">Báo Cáo Thực Phẩm</h1>
        </div>
        <button
          onClick={() => fetchHistory(historyDays)}
          className="w-9 h-9 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 text-zinc-500"
          title="Tải lại báo cáo"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </section>

      {/* Stats Summary Bento Grid */}
      <section className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-1 shadow-xs text-left">
          <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase font-mono">Đã tiêu thụ</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-zinc-900">{totalThisWeek}</span>
            <span className="text-[10px] text-zinc-500 font-semibold uppercase">vật phẩm</span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-normal font-semibold mt-1">Lượng thực phẩm đã nấu ăn hoặc thu dọn trong giai đoạn này.</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-1 shadow-xs text-left">
          <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase font-mono">Dùng nhiều nhất</span>
          <div className="flex items-baseline gap-1 mt-1 truncate">
            <span className="text-[13px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase truncate max-w-full">
              {getFavoriteCategory()}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-normal font-semibold mt-1">Nhóm dưỡng chất chính bạn bổ sung nhiều nhất giai đoạn này.</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-1 col-span-2 shadow-xs text-left">
          <div className="flex justify-between items-center text-[9px] font-black tracking-widest text-zinc-400 uppercase font-mono">
            <span>Ngày dùng đỉnh điểm</span>
            <span className="text-amber-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> Cao nhất</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-extrabold text-zinc-950">{peakDay.day}</span>
            <span className="text-xs font-bold text-zinc-500">
              Đã dùng: <strong className="font-extrabold text-zinc-900">{peakDay['Tổng cộng']} món</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Main RECHARTS LINE CHART Section */}
      <section className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-0.5 text-left">
              <h3 className="font-bold text-zinc-900 text-xs tracking-widest uppercase font-mono">
                Xu hướng tiêu thụ {historyDays} ngày
              </h3>
              <p className="text-[10px] text-zinc-500 leading-normal font-bold">
                Số lượng nguyên liệu từng phân nhóm được sơ chế và chế biến hàng ngày.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={historyDays}
                onChange={(e) => setHistoryDays(Number(e.target.value))}
                className="text-[10px] font-black text-zinc-700 bg-zinc-50 hover:bg-zinc-105 px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono cursor-pointer transition-all uppercase tracking-wider"
                id="chart-days-dropdown"
              >
                <option value={7}>7 ngày</option>
                <option value={14}>14 ngày</option>
                <option value={30}>30 ngày</option>
              </select>
              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 uppercase tracking-widest font-mono hidden sm:inline-block">LIVE CHART</span>
            </div>
          </div>
        </div>

        {/* Dynamic Lines Selection Toggles styled beautifully */}
        <div className="flex flex-wrap gap-1.5 py-1 border-y border-zinc-100 text-[9px] font-bold uppercase tracking-wider">
          <button
            onClick={() => setShowMeats(!showMeats)}
            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              showMeats 
                ? 'bg-amber-50 text-amber-700 border-amber-200 font-extrabold' 
                : 'bg-zinc-50 text-zinc-400 border-zinc-150'
            }`}
          >
            ● Thịt cá
          </button>
          
          <button
            onClick={() => setShowVeggies(!showVeggies)}
            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              showVeggies 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold' 
                : 'bg-zinc-50 text-zinc-400 border-zinc-150'
            }`}
          >
            ● Rau củ quả
          </button>

          <button
            onClick={() => setShowDairy(!showDairy)}
            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              showDairy 
                ? 'bg-blue-50 text-blue-700 border-blue-200 font-extrabold' 
                : 'bg-zinc-50 text-zinc-400 border-zinc-150'
            }`}
          >
            ● Sữa/Trứng
          </button>

          <button
            onClick={() => setShowOthers(!showOthers)}
            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              showOthers 
                ? 'bg-cyan-50 text-cyan-700 border-cyan-200 font-extrabold' 
                : 'bg-zinc-50 text-zinc-400 border-zinc-150'
            }`}
          >
            ● Đồ Khác
          </button>

          <button
            onClick={() => setShowTotal(!showTotal)}
            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ml-auto ${
              showTotal 
                ? 'bg-zinc-900 text-white border-zinc-900 font-extrabold animate-pulse' 
                : 'bg-zinc-100 text-zinc-500 border-zinc-200'
            }`}
          >
            ∑ Tổng
          </button>
        </div>

        {/* Interactive Line Chart Rendering */}
        <div className="w-full h-[240px] mt-1 relative flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-zinc-400 text-xs py-10">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="font-semibold">Đang tổng kết dữ liệu tiêu thụ...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 text-xs">
              <AlertCircle className="w-5 h-5 mx-auto mb-2 text-zinc-300" />
              Chưa có dữ liệu. Hãy thêm nguyên liệu rồi thực hiện nấu ăn!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 10, left: -24, bottom: 0 }}>
                <defs>
                  <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.08"/>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 9, fill: '#88888c', fontWeight: 'bold' }} 
                  stroke="#e4e4e7" 
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 9, fill: '#88888c', fontWeight: 'bold' }} 
                  stroke="#e4e4e7" 
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderRadius: '16px',
                    borderColor: '#27272a',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontFamily: 'sans-serif',
                    padding: '8px 12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: '#a1a1aa' }}
                  labelStyle={{ fontWeight: 'black', color: '#34d399', marginBottom: '4px', textTransform: 'uppercase' }}
                />
                
                {showMeats && (
                  <Line 
                    type="monotone" 
                    dataKey="Thịt cá" 
                    stroke="#f59e0b" 
                    strokeWidth={3} 
                    dot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }} 
                  />
                )}
                {showVeggies && (
                  <Line 
                    type="monotone" 
                    dataKey="Rau củ quả" 
                    stroke="#059669" 
                    strokeWidth={3} 
                    dot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }} 
                  />
                )}
                {showDairy && (
                  <Line 
                    type="monotone" 
                    dataKey="Sữa & Trứng" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }} 
                  />
                )}
                {showOthers && (
                  <Line 
                    type="monotone" 
                    dataKey="Gia vị & Khác" 
                    stroke="#06b6d4" 
                    strokeWidth={3} 
                    dot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }} 
                  />
                )}
                {showTotal && (
                  <Line 
                    type="monotone" 
                    dataKey="Tổng cộng" 
                    stroke="#18181b" 
                    strokeWidth={4} 
                    strokeDasharray="5 5"
                    dot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 8 }} 
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* GEMINI AI CLINICAL CONSUMPTION DIETARY REPORT */}
      <section className="bg-zinc-900 text-white rounded-3xl p-6 border border-zinc-800 shadow-xl flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-0.5 text-left">
            <span className="text-[9px] font-black tracking-widest text-emerald-400 font-mono uppercase">Trợ Lý Dinh Dưỡng Thượng Cấp</span>
            <h3 className="text-base font-black tracking-tight text-white mt-1">Phân Tích Sức Khỏe Gemini AI</h3>
          </div>
          <div className="p-1.5 bg-emerald-950 rounded-xl text-emerald-400 border border-emerald-900 flex-shrink-0 animate-pulse">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed text-left font-medium">
          Dịch vụ Gemini AI quét toán bộ giỏ lạnh khả dụng và lịch sử đun nấu tuần này để lập báo cáo dinh dưỡng, cân bằng rác thải thực phẩm và thiết lập mâm cơm cứu sinh 48 giờ tới dứt điểm.
        </p>

        {aiReport ? (
          <div className="bg-zinc-950 border border-zinc-850/80 rounded-2xl p-4 text-[11px] leading-relaxed text-zinc-300 text-left space-y-1 mt-2 max-h-72 overflow-y-auto animate-fade-in divide-y divide-zinc-900">
            <div>
              {renderFormattedReport(aiReport)}
            </div>
            <div className="pt-3 mt-3 flex justify-end">
              <button 
                onClick={generateAIInsights}
                className="text-[10px] font-extrabold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-950/40 px-3 py-1 bg-opacity-40 rounded border border-emerald-900 cursor-pointer uppercase tracking-wider"
              >
                Tạo báo cao mới
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={generateAIInsights}
            disabled={insightsLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-all active:scale-95 text-center flex items-center justify-center gap-2 mt-1 shadow-md shadow-emerald-950 cursor-pointer disabled:opacity-50"
          >
            {insightsLoading ? (
              <>
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
                <span>Đang phân tích cấu trúc bữa ăn...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white animate-spin-slow" />
                <span>Yêu Cầu Gemini Gửi Báo Cáo Phân Tích</span>
              </>
            )}
          </button>
        )}
      </section>

      {/* GEMINI AI SHOPPING FORECAST */}
      <section className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-xs flex flex-col gap-4 text-left">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black tracking-widest text-emerald-600 font-mono uppercase">AI Dự toán Chi Tiêu</span>
            <h3 className="text-base font-extrabold tracking-tight text-zinc-900">Dự Báo Nguyên Liệu Tuần Tới</h3>
            <p className="text-[10px] text-zinc-400 font-semibold leading-normal">
              Hệ thống quét thói quen đun nấu tuần qua và tủ lạnh lúc này để lập danh sách mua sắm đề xuất.
            </p>
          </div>
          <div className="p-2 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100 flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {forecastLoading ? (
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[140px] animate-pulse">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-zinc-800">Đang học thói quen đun nấu...</p>
              <p className="text-[10px] text-zinc-400 font-semibold leading-normal">Trí tuệ nhân tạo đang cân đối rác thải dinh dưỡng của mâm cơm Việt.</p>
            </div>
          </div>
        ) : forecastText ? (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* The Analysis Context */}
            <div className="bg-emerald-50/20 border border-emerald-100 p-4 rounded-2xl text-[11px] text-zinc-650 leading-relaxed font-semibold relative before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-emerald-500 before:rounded-r">
              <p className="pl-1 text-zinc-700 font-medium">{forecastText}</p>
            </div>

            {/* Proposed Ingredients Checklist */}
            {predictedIngredients.length === 0 ? (
              <div className="text-center py-6 text-zinc-400 text-xs">
                Không có nguyên liệu nào cần mua bổ sung dựa trên thói quen hiện tại.
              </div>
            ) : (
              <div className="space-y-3">
                <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase font-mono">DANH SÁCH GIỎ HÀNG GỢI Ý:</span>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {predictedIngredients.map((item, idx) => {
                    const itemKey = `${item.name}-${idx}`;
                    const isSelected = !!selectedForecastItems[itemKey];
                    
                    let catColor = "bg-stone-50 text-stone-500 border-stone-200/60";
                    let catName = "Gia vị khác";
                    const cat = (item.category || '').toLowerCase();
                    if (cat === 'meats') {
                      catColor = "bg-amber-50 text-amber-700 border-amber-100";
                      catName = "Thịt cá";
                    } else if (cat === 'veggies' || cat === 'produce') {
                      catColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      catName = "Rau xanh";
                    } else if (cat === 'dairy') {
                      catColor = "bg-blue-50 text-blue-700 border-blue-100";
                      catName = "Sữa trứng";
                    }

                    return (
                      <div 
                        key={idx}
                        onClick={() => toggleForecastItemSelection(itemKey)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isSelected 
                            ? 'bg-zinc-50 border-zinc-900 shadow-xs' 
                            : 'bg-white border-zinc-200 hover:bg-zinc-50/40 text-zinc-400 opacity-60'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-lg border-2 mt-0.5 flex items-center justify-center transition-all ${
                          isSelected 
                            ? 'bg-zinc-900 border-zinc-900 text-white' 
                            : 'border-zinc-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-extrabold text-xs leading-tight ${isSelected ? 'text-zinc-900' : 'text-zinc-400 line-through'}`}>{item.name}</span>
                            <span className="text-[10px] font-bold text-zinc-400">• Định lượng: {item.quantity}</span>
                          </div>
                          
                          <p className={`text-[10px] mt-1 leading-relaxed font-semibold ${isSelected ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {item.reason}
                          </p>

                          <div className="mt-1.5 flex gap-1.5 items-center">
                            <span className={`text-[8px] font-black uppercase border px-1.5 py-0.5 rounded leading-none ${catColor}`}>
                              {catName}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleAddSelectedToShopping}
                    disabled={predictedIngredients.filter((item, idx) => selectedForecastItems[`${item.name}-${idx}`]).length === 0}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-extrabold py-3.5 rounded-2xl text-[11px] transition-all active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-zinc-200"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>
                      Nhập {predictedIngredients.filter((item, idx) => selectedForecastItems[`${item.name}-${idx}`]).length} gợi ý vào Giỏ Đi Chợ tuyển lựa
                    </span>
                  </button>

                  {addSuccess && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] px-3 py-2.5 rounded-xl text-center font-bold flex items-center justify-center gap-1.5 animate-scale-up">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                      Đã thêm thành công vào Giỏ Đi Chợ! Hãy chuyển sang thẻ "Giỏ Đi Chợ" của bạn để chuẩn bị mua sắm.
                    </div>
                  )}

                  <button
                    onClick={generateForecast}
                    className="w-full text-zinc-500 hover:text-zinc-700 font-extrabold py-1.5 text-[10px] text-center cursor-pointer transition-colors uppercase tracking-wider mt-1"
                  >
                    Tải lại dự toán mua sắm AI mới
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={generateForecast}
            disabled={forecastLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-all active:scale-95 text-center flex items-center justify-center gap-2 mt-1 shadow-md shadow-emerald-50 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
            <span>Yêu Cầu Gemini Dự Báo Nguyên Liệu Tuần Tới</span>
          </button>
        )}
      </section>

      {/* RAW DIARY LOGS LIST */}
      <section className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex flex-col gap-4 text-left">
        <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
          <div>
            <h3 className="font-bold text-zinc-900 text-xs tracking-widest uppercase font-mono">Nhật ký tiêu thụ thực phẩm</h3>
            <p className="text-[10px] text-zinc-400 mt-1 leading-normal font-semibold">Từng nguyên liệu đã sơ chế và dọn gọn</p>
          </div>
          <button 
            onClick={() => setShowManualForm(!showManualForm)}
            className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100 uppercase tracking-wide cursor-pointer hover:bg-emerald-100 transition-all active:scale-95 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" /> Thêm nhanh
          </button>
        </div>

        {/* Manual Add Consumption Form */}
        {showManualForm && (
          <form onSubmit={handleManualLogSubmit} className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl flex flex-col gap-3 text-xs animate-scale-up">
            <div className="flex flex-col gap-1">
              <span className="font-extrabold text-zinc-700 uppercase tracking-wider text-[9px]">Tên nguyên liệu đã dùng</span>
              <input 
                type="text" 
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ví dụ: 100g Giá đỗ, 1 vỉ Nấm xào..."
                className="bg-white border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="font-extrabold text-zinc-700 uppercase tracking-wider text-[9px]">Số lượng</span>
                <input 
                  type="text" 
                  value={manualQuantity}
                  onChange={(e) => setManualQuantity(e.target.value)}
                  placeholder="Ví dụ: 300g, 1 vỉ"
                  className="bg-white border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-extrabold text-zinc-700 uppercase tracking-wider text-[9px]">Thể loại</span>
                <select 
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="bg-white border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="Meats">Thịt cá (Meats)</option>
                  <option value="Veggies">Rau củ quả (Veggies)</option>
                  <option value="Dairy">Sữa / Trứng (Dairy)</option>
                  <option value="Condiments">Gia vị / Khác (Condiments)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1 font-semibold">
              <button 
                type="button"
                onClick={() => setShowManualForm(false)}
                className="flex-1 bg-zinc-200 text-zinc-700 py-2.5 rounded-xl text-[11px] text-center cursor-pointer active:scale-95"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-[11px] text-center cursor-pointer font-bold active:scale-95 shadow"
              >
                Ghi vào sổ
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
          {rawLogs.length === 0 ? (
            <div className="text-center py-10 bg-zinc-50 rounded-2xl border text-zinc-400 text-xs">
              Mâm cơm tuần mới trống trơn! Hãy bắt đầu mở bếp.
            </div>
          ) : (
            sortedDates.map((dateStr) => (
              <div key={dateStr} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mt-2 first:mt-0 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-extrabold text-[10px] tracking-wider text-zinc-650 uppercase font-sans">
                    {formatFriendlyDate(dateStr)}
                  </span>
                  <div className="h-[1px] bg-zinc-100 flex-grow"></div>
                  <span className="text-[9px] font-bold text-zinc-400 bg-zinc-50 border border-zinc-150 px-1.5 py-0.5 rounded-md">
                    {groupedLogs[dateStr].length} nguyên liệu
                  </span>
                </div>

                <div className="space-y-2 pl-0.5">
                  {groupedLogs[dateStr].map((log) => {
                    let dotColor = "bg-stone-400";
                    let catName = "Gia vị khác";
                    
                    const cat = (log.category || '').toLowerCase();
                    if (cat === 'meats') {
                      dotColor = "bg-amber-500";
                      catName = "Thịt & Cá";
                    } else if (cat === 'veggies' || cat === 'produce') {
                      dotColor = "bg-emerald-600";
                      catName = "Rau xanh";
                    } else if (cat === 'dairy') {
                      dotColor = "bg-blue-500";
                      catName = "Sữa & Trứng";
                    }
                    
                    return (
                      <div 
                        key={log.id}
                        className="bg-zinc-50/60 p-3 rounded-2xl border border-zinc-200/60 flex items-center justify-between transition-colors hover:bg-zinc-100/50 shadow-3xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-zinc-900 text-xs">{log.ingredient_name}</span>
                            <span className="text-[10px] text-zinc-400 font-semibold uppercase font-mono leading-none">
                              Số lượng: {log.quantity}
                            </span>
                          </div>
                        </div>

                        <span className="text-[9px] font-black uppercase text-zinc-500 bg-white border border-zinc-200 px-2 py-0.5 rounded flex items-center gap-1.5 font-sans leading-none shadow-4xs">
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                          {catName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
