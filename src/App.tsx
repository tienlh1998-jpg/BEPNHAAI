import { useState, useEffect } from 'react';
import { 
  Home as HomeIcon, BookOpen, ShoppingBasket, User as UserIcon, Bell, Sparkles, ChefHat, Database, RefreshCw, Layers, Sun, Moon,
  X, Trash2, AlertTriangle, Info, Check
} from 'lucide-react';
import { 
  Ingredient, ExpiryAlert, FridgeStatus, Recipe, ShoppingItem, DashboardResponse 
} from './types';
import Dashboard from './components/Dashboard';
import RecipeMatching from './components/RecipeMatching';
import ShoppingList from './components/ShoppingList';
import ConsumptionHistory from './components/ConsumptionHistory';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'recipes' | 'list' | 'profile'>('home');
  const [status, setStatus] = useState<FridgeStatus>({
    percentage: 75,
    emptyPercentage: 25,
    breakdown: { meats: 25, veggies: 40, condiments: 20, dryFood: 15 }
  });
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cookedRecipes, setCookedRecipes] = useState<Recipe[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  
  // Loading & Action States
  const [fullLoading, setFullLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(3);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Notifications State & Calculations
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>([]);

  interface AppNotification {
    id: string;
    title: string;
    description: string;
    type: 'danger' | 'warning' | 'success' | 'info';
    timestamp: string;
  }

  const getActiveNotifications = (): AppNotification[] => {
    const list: AppNotification[] = [];

    // 1. Expiry alerts from actual fridge
    expiryAlerts.forEach((alert) => {
      let type: 'danger' | 'warning' = 'warning';
      if (typeof alert.daysRemaining === 'number' && alert.daysRemaining <= 0) {
        type = 'danger';
      }
      list.push({
        id: `expiry-${alert.id}`,
        title: alert.daysRemaining <= 0 ? "Thực phẩm quá hạn dùng!" : "Thực phẩm sắp hết hạn",
        description: alert.alertText || `${alert.name} (${alert.quantity}) còn lại ${alert.daysRemaining} ngày sử dụng trong tủ lạnh.`,
        type: type,
        timestamp: alert.daysRemaining <= 0 ? "Đã quá hạn" : `Còn ${alert.daysRemaining} ngày`
      });
    });

    // 2. Welcome default
    list.push({
      id: 'system-welcome',
      title: 'Hệ thống Bếp Nhà AI sẵn sàng',
      description: 'Cơ sở dữ liệu phòng bếp SQLite kết nối thông suốt, đã sẵn sàng kết nối cùng Gemini AI.',
      type: 'success',
      timestamp: 'Hệ thống'
    });

    // 3. Tip
    list.push({
      id: 'system-tip',
      title: 'Đầu bếp AI khuyên dùng',
      description: 'Nhấn vào nút "Menu Gemini AI" ở tab Mâm Cơm AI để nhận 3 gợi ý thực đơn chất lượng cho ngày hôm nay nhé!',
      type: 'info',
      timestamp: 'Sáng tạo'
    });

    return list.filter(item => !dismissedNotifIds.includes(item.id));
  };

  const activeNotifications = getActiveNotifications();
  const displayNotifCount = activeNotifications.length;

  // Browser Notification States
  const [btnNotifPermission, setBtnNotifPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBtnNotifPermission(Notification.permission);
    }
  }, []);

  const checkAndTriggerPush = (alerts: ExpiryAlert[]) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const critical = alerts.filter(a => a.daysRemaining !== null && a.daysRemaining !== undefined && a.daysRemaining <= 2);
    if (critical.length === 0) return;

    try {
      const notifiedStr = sessionStorage.getItem('chefpantry_desktop_notified') || '[]';
      const notifiedList: string[] = JSON.parse(notifiedStr);

      const itemsToNotify = critical.filter(a => !notifiedList.includes(`${a.id}-${a.daysRemaining}`));
      if (itemsToNotify.length > 0) {
        if (itemsToNotify.length === 1) {
          const item = itemsToNotify[0];
          new Notification("⚠️ Thực phẩm sắp hết hạn!", {
            body: `${item.name} (${item.quantity}) chỉ còn lại ${item.daysRemaining} ngày sử dụng! Hãy nấu ngay.`,
            icon: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=100&auto=format&fit=crop"
          });
        } else {
          new Notification("⚠️ Nhiều thực phẩm sắp hết hạn!", {
            body: `Tủ lạnh của bạn đang có ${itemsToNotify.length} thực phẩm gần hết hạn sử dụng. Hãy kiểm tra ngay.`,
            icon: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=100&auto=format&fit=crop"
          });
        }

        const updatedList = [...notifiedList, ...itemsToNotify.map(a => `${a.id}-${a.daysRemaining}`)];
        sessionStorage.setItem('chefpantry_desktop_notified', JSON.stringify(updatedList));
      }
    } catch (e) {
      console.error("Lỗi gửi thông báo Notification API:", e);
    }
  };

  const requestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ công cụ Notification-API.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setBtnNotifPermission(permission);
      if (permission === 'granted') {
        new Notification("Bếp Nhà AI Kính Chào!", {
          body: "Bạn đã kích hoạt thông báo đẩy trình duyệt thành công! Thông báo sẽ hiển thị khi có thực phẩm sắp hết hạn.",
          icon: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=100&auto=format&fit=crop"
        });
        checkAndTriggerPush(expiryAlerts);
      } else if (permission === 'denied') {
        alert('Bạn đã chặn thông báo đẩy. Hãy cập nhật thiết lập trên thanh địa chỉ của trình duyệt để kích hoạt lại.');
      }
    } catch (err) {
      console.error("Lỗi xin cấp quyền Notification:", err);
    }
  };

  // Theme Toggler state & effect
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 1. Fetch Dashboard Consolidated Stats from Express APIs
  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load cabinet status.');
      const data: DashboardResponse = await res.json();
      setStatus(data.fridgeStatus);
      setExpiryAlerts(data.expiryAlerts);
      setNotifCount(data.expiryAlerts.filter(a => a.daysRemaining <= 2).length);
      
      // Auto trigger browser push notification if granted and have expiring items
      checkAndTriggerPush(data.expiryAlerts);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Mất kết nối với Bếp Nhà AI server.');
    }
  };

  // 2. Fetch Stock Ingredients
  const fetchIngredients = async () => {
    try {
      const res = await fetch('/api/ingredients');
      if (!res.ok) throw new Error('Failed to load ingredients.');
      const data = await res.json();
      setIngredients(data.ingredients);
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Fetch Shopping Checklist
  const fetchShoppingList = async () => {
    try {
      const res = await fetch('/api/shopping-list');
      if (!res.ok) throw new Error('Failed to load shopping list.');
      const data = await res.json();
      setShoppingList(data.shoppingList);
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Load initial curated recipes
  const fetchRecipes = async () => {
    try {
      const res = await fetch('/api/recipes');
      if (!res.ok) throw new Error('Failed to fetch recipes.');
      const data = await res.json();
      setRecipes(data.recipes);
    } catch (err) {
      console.error(err);
    }
  };

  // 4b. Load cooked recipes history
  const fetchCookedRecipes = async () => {
    try {
      const res = await fetch('/api/cooked-recipes');
      if (!res.ok) throw new Error('Failed to fetch cooked recipes.');
      const data = await res.json();
      setCookedRecipes(data.cookedRecipes || []);
    } catch (err) {
      console.error(err);
    }
  };

  const initialLoad = async () => {
    setFullLoading(true);
    setErrorMsg(null);
    await Promise.all([
      fetchDashboard(),
      fetchIngredients(),
      fetchShoppingList(),
      fetchRecipes(),
      fetchCookedRecipes()
    ]);
    setFullLoading(false);
  };

  useEffect(() => {
    initialLoad();
  }, []);

  // API Callbacks: Ingredients mutations
  const handleAddIngredient = async (item: { name: string; category: any; quantity: string; expiry_date: string }) => {
    try {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (!res.ok) throw new Error('Could not add item to fridge.');
      await fetchIngredients();
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Lỗi thêm vật phẩm vào tủ lạnh.');
    }
  };

  const handleRemoveIngredient = async (id: number) => {
    try {
      const res = await fetch(`/api/ingredients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove item.');
      await fetchIngredients();
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Lỗi dọn vật phẩm khỏi tủ lạnh.');
    }
  };

  // API Callbacks: Recipes Dynamic Match via server side Gemini
  const handleTriggerGeminiMatch = async (category?: string) => {
    try {
      const res = await fetch('/api/recipe-match', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      if (!res.ok) throw new Error('Gemini Matching encountered error.');
      const data = await res.json();
      if (data.recipes) {
        setRecipes(data.recipes);
        // Switch tab automatically to Recipes with focus
        setActiveTab('recipes');
        return data.recipes;
      }
      return null;
    } catch (err: any) {
      alert('Không kết nối được Gemini API: ' + (err.message || 'Lỗi mạng'));
      return null;
    }
  };

  // API Callbacks: Shopping List Checklist mutations
  const handleAddShoppingItem = async (item: { name: string; category?: string; quantity?: string }) => {
    try {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (!res.ok) throw new Error('Could not append item.');
      await fetchShoppingList();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleShoppingItem = async (id: number, checked: boolean) => {
    try {
      const res = await fetch(`/api/shopping-list/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_checked: checked })
      });
      if (!res.ok) throw new Error('Could not toggle check state.');
      await fetchShoppingList();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddBatchToShopping = async (items: { name: string; category: string; quantity: string }[]) => {
    try {
      const res = await fetch('/api/shopping-list/add-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (!res.ok) throw new Error('Batch grocery loading failed.');
      await fetchShoppingList();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClearShoppingList = async () => {
    try {
      const res = await fetch('/api/shopping-list', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to empty cart.');
      await fetchShoppingList();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="bg-background text-zinc-900 min-h-screen relative pb-28 md:pb-6 flex flex-col font-sans select-none antialiased">
      {/* TopAppBar Navigation */}
      <header className="fixed top-0 w-full z-45 border-b backdrop-blur-md transition-all duration-300 bg-gradient-to-r from-emerald-50/95 via-white/98 to-emerald-50/95 border-emerald-100 dark:from-emerald-950/95 dark:via-zinc-900/98 dark:to-emerald-950/95 dark:border-emerald-900/40 shadow-xs">
        <div className="flex justify-between items-center px-4 h-16 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-2.5 rounded-xl text-white shadow-md shadow-emerald-200/50 flex items-center justify-center transition-all hover:scale-105 shrink-0">
              <ChefHat className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <span className="text-base font-black tracking-tight text-zinc-950 dark:text-zinc-50 whitespace-nowrap">
              Bếp Nhà <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggler Button */}
            <button 
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-650 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all active:scale-95 border border-emerald-100 dark:border-emerald-800/40 bg-white/90 dark:bg-zinc-900 shadow-3xs"
              title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-emerald-700" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500 animate-pulse" />
              )}
            </button>

            <button 
              onClick={() => setShowNotifPopup(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-650 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all relative active:scale-95 border border-emerald-100 dark:border-emerald-800/40 bg-white/90 dark:bg-zinc-900 shadow-3xs cursor-pointer"
              title="Xem thông báo tủ lạnh và gợi ý ẩm thực"
            >
              <Bell className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              {displayNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-[10px] text-white font-black flex items-center justify-center rounded-full animate-bounce">
                  {displayNotifCount}
                </span>
              )}
            </button>

            {/* Profile Picture */}
            <button 
              onClick={() => setActiveTab('profile')}
              className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-100 dark:border-emerald-800/40 cursor-pointer hover:opacity-90 active:scale-95 transition-all bg-white/90 dark:bg-zinc-900 shadow-3xs flex items-center justify-center p-0.5 shrink-0"
              title="Thông tin báo cáo"
            >
              <img 
                alt="Chef Profile Avatar" 
                className="w-full h-full rounded-lg object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDaYYMuysNET1fbK24d8R78dC87PhHX8J19WMVFA0HnLgqeLcA7mZvJ7GogsgSbxj58Pz397d8Qzk6LTJCLqTv0dg7ONo8Ft7TMTusJ8HTQPYHctgaAJJUwhZ9Vj7mHjDkEfz8G1fbv5AYEnfkGJks15SnRnanMEcv_aveFW-YediHYXTenBL5RsSf9lfOPchRhK1xBvIGMnh3a5nNDullu-dsxqdc2PjKgIHIQ0D1LyVLIXKsYku-LXGR3ReFCdoTUv_wQTraHMqM"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Wrapper */}
      <main className="pt-24 px-margin-mobile flex-grow max-w-md mx-auto w-full flex flex-col h-full">
        {fullLoading ? (
          <div className="flex-grow flex flex-col justify-center items-center gap-base py-20 text-on-surface-variant">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="font-semibold text-xs animate-pulse">Đang đồng bộ cơ sở dữ liệu SQLite...</p>
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 text-red-800 p-md rounded-2xl border border-red-200 text-center my-10 space-y-3">
            <p className="font-semibold text-sm">{errorMsg}</p>
            <button 
              onClick={initialLoad}
              className="px-4 py-2 bg-red-600 text-white rounded-full text-xs font-bold shadow hover:bg-red-700 active:scale-95"
            >
              Thử Lại Kết Nối
            </button>
          </div>
        ) : (
          <div className="pb-10 flex-grow">
            {activeTab === 'home' && (
              <Dashboard 
                status={status}
                alerts={expiryAlerts}
                ingredients={ingredients}
                onRefresh={initialLoad}
                onAddIngredient={handleAddIngredient}
                onRemoveIngredient={handleRemoveIngredient}
              />
            )}

            {activeTab === 'recipes' && (
              <RecipeMatching 
                recipes={recipes}
                cookedRecipes={cookedRecipes}
                onRefreshRecipes={async () => {
                  await fetchRecipes();
                  await fetchCookedRecipes();
                }}
                onTriggerGeminiMatch={handleTriggerGeminiMatch}
                onAddMissingToShopping={async (missingNames) => {
                  const payload = missingNames.map(name => ({
                    name,
                    category: 'Staple',
                    quantity: '1 unit'
                  }));
                  await handleAddBatchToShopping(payload);
                }}
              />
            )}

            {activeTab === 'list' && (
              <ShoppingList 
                shoppingList={shoppingList}
                onAddShoppingItem={handleAddShoppingItem}
                onToggleShoppingItem={handleToggleShoppingItem}
                onClearShoppingList={handleClearShoppingList}
                onAddBatchToShopping={handleAddBatchToShopping}
              />
            )}

            {activeTab === 'profile' && (
              <div className="flex flex-col gap-md animate-fade-in pb-10" id="profile-view">
                <section className="text-center py-4 flex flex-col items-center gap-xs">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary shadow-sm bg-zinc-50">
                    <img 
                      alt="Chef Avatar Large" 
                      className="w-full h-full object-cover" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDaYYMuysNET1fbK24d8R78dC87PhHX8J19WMVFA0HnLgqeLcA7mZvJ7GogsgSbxj58Pz397d8Qzk6LTJCLqTv0dg7ONo8Ft7TMTusJ8HTQPYHctgaAJJUwhZ9Vj7mHjDkEfz8G1fbv5AYEnfkGJks15SnRnanMEcv_aveFW-YediHYXTenBL5RsSf9lfOPchRhK1xBvIGMnh3a5nNDullu-dsxqdc2PjKgIHIQ0D1LyVLIXKsYku-LXGR3ReFCdoTUv_wQTraHMqM"
                    />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-zinc-800">Senior Developer Chef</h2>
                    <span className="font-mono text-[9px] text-white bg-emerald-600 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold leading-none mt-1 inline-block">
                      Full-Stack Active
                    </span>
                  </div>
                </section>

                <ConsumptionHistory />

                {/* System technical architecture documentation collapsed neatly */}
                <details className="bg-white rounded-3xl p-5 shadow-xs border border-zinc-200 mt-2 text-zinc-500 cursor-pointer select-none group">
                  <summary className="font-black text-[10px] uppercase tracking-widest text-zinc-400 flex items-center justify-between list-none">
                    <span>Hồ Sơ Kiến Trúc Hệ Thống (DDL & Tech)</span>
                    <span className="text-xs transition-transform duration-200 group-open:rotate-180">▼</span>
                  </summary>
                  
                  <div className="mt-4 text-xs text-zinc-650 space-y-4 border-t border-zinc-100 pt-4 leading-relaxed cursor-default" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-zinc-800 text-xs flex items-center gap-2 uppercase tracking-wider">
                        <Database className="w-4 h-4 text-emerald-600" /> Offline-First Architecture
                      </h3>
                      <span className="text-emerald-600 font-mono font-black tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">v2.1.0</span>
                    </div>

                    <p>
                      Mô hình full-stack Bếp Nhà AI cho phép lưu trữ toàn bộ nghiệp vụ tủ lạnh dưới dạng ngoại tuyến dựa trên cấu trúc SQLite được đóng gói và cập nhật trực tiếp qua API.
                    </p>

                    <div className="space-y-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200/60">
                      <h4 className="font-bold text-emerald-700 flex items-center gap-1.5 text-[11px]">
                        <Layers className="w-4 h-4" /> Báo Cáo Kỹ Thuật Đã Triển Khai:
                      </h4>
                      <ol className="list-decimal list-inside space-y-1.5 text-zinc-700 pl-1 text-[11px]">
                        <li>
                          <strong>SQLite DDL Script</strong>: Cấu trúc 3 bảng quan hệ ràng buộc hoàn chỉnh tại <code className="bg-white px-1.5 py-0.5 rounded border border-zinc-200 font-mono text-[10px]">src/db/schema.sql</code>.
                        </li>
                        <li>
                          <strong>AI Matching (Gemini SDK)</strong>: Bản dựng logic gọi trực tiếp mô hình <code className="bg-white px-1.5 py-0.5 rounded border border-zinc-200 font-mono text-[10px]">gemini-3.5-flash</code> và tối ưu hóa mâm cơm lành mạnh.
                        </li>
                        <li>
                          <strong>Nhật ký tiêu thụ (Recharts LineChart)</strong>: Trục biểu diễn tiêu đề thời gian thực 7 ngày, giúp kiểm soát hiệu năng nấu nướng và dự báo rác thải.
                        </li>
                      </ol>
                    </div>

                    <p className="italic text-[9px] text-center text-zinc-400 pt-2 border-t border-zinc-100">
                      Designed with high design guidelines • Built by AI Coding Agent
                    </p>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Persistent BottomNavBar (Mobile Only style representing professional native applications) */}
      <nav className="fixed bottom-0 left-0 w-full rounded-t-3xl border-t shadow-[0px_-8px_32px_rgba(26,92,64,0.06)] z-40 transition-all duration-300 pb-safe bg-gradient-to-r from-emerald-50/95 via-white/95 to-emerald-50/95 border-emerald-100 dark:from-emerald-950/95 dark:via-zinc-900/95 dark:to-emerald-950/95 dark:border-emerald-900/30">
        <div className="flex justify-around items-center px-4 py-2.5 max-w-md mx-auto gap-1">
          {/* Home Tab */}
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-2 px-3 transition-all duration-200 relative outline-none flex-1 ${
              activeTab === 'home' 
                ? 'bg-emerald-600 dark:bg-emerald-700 text-white font-black rounded-2xl scale-105 shadow-sm shadow-emerald-900/20' 
                : 'text-zinc-500 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 rounded-xl'
            }`}
          >
            <HomeIcon className={`w-5 h-5 ${activeTab === 'home' ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
            <span className="text-[10px] mt-1 font-bold tracking-tight">Trang Chủ</span>
          </button>

          {/* Recipes Tab */}
          <button 
            onClick={() => setActiveTab('recipes')}
            className={`flex flex-col items-center justify-center py-2 px-3 transition-all duration-200 relative outline-none flex-1 ${
              activeTab === 'recipes' 
                ? 'bg-emerald-600 dark:bg-emerald-700 text-white font-black rounded-2xl scale-105 shadow-sm shadow-emerald-900/20' 
                : 'text-zinc-500 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 rounded-xl'
            }`}
          >
            <BookOpen className={`w-5 h-5 ${activeTab === 'recipes' ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
            <span className="text-[10px] mt-1 font-bold tracking-tight">Mâm Cơm AI</span>
          </button>

          {/* Shopping Checklist Tab */}
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex flex-col items-center justify-center py-2 px-3 transition-all duration-200 relative outline-none flex-1 ${
              activeTab === 'list' 
                ? 'bg-emerald-600 dark:bg-emerald-700 text-white font-black rounded-2xl scale-105 shadow-sm shadow-emerald-900/20' 
                : 'text-zinc-500 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 rounded-xl'
            }`}
          >
            <ShoppingBasket className={`w-5 h-5 ${activeTab === 'list' ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
            <span className="text-[10px] mt-1 font-bold tracking-tight">Giỏ Đi Chợ</span>
          </button>

          {/* Profile Details Tab */}
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center py-2 px-3 transition-all duration-200 relative outline-none flex-1 ${
              activeTab === 'profile' 
                ? 'bg-emerald-600 dark:bg-emerald-700 text-white font-black rounded-2xl scale-105 shadow-sm shadow-emerald-900/20' 
                : 'text-zinc-500 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 rounded-xl'
            }`}
          >
            <UserIcon className={`w-5 h-5 ${activeTab === 'profile' ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
            <span className="text-[10px] mt-1 font-bold tracking-tight">Báo Cáo</span>
          </button>
        </div>
      </nav>

      {/* NOTIFICATION CENTER MODAL */}
      {showNotifPopup && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-zinc-100 flex flex-col gap-4 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-xl text-emerald-600">
                  <Bell className="w-4 h-4 text-emerald-600 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-sm text-zinc-900">Thông báo từ Bếp Nhà AI</h3>
              </div>
              <button 
                onClick={() => setShowNotifPopup(false)}
                className="p-1 rounded-full text-zinc-400 hover:bg-zinc-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Lưu giữ nhật ký hạn sử dụng của thực phẩm và các lời khuyên từ Trợ lý Gemini AI hữu dụng.
              </p>
            </div>

            {/* Desktop Web Push Setup Section */}
            <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-3 flex flex-col gap-2 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase font-mono">Thông báo đẩy trình duyệt</span>
                {btnNotifPermission === 'granted' ? (
                  <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">Đã kích hoạt</span>
                ) : btnNotifPermission === 'denied' ? (
                  <span className="text-[9px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase">Bị chặn</span>
                ) : (
                  <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase font-mono font-medium">Chưa bật</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal font-medium">
                Kích hoạt để nhận cảnh báo tức thì ngay trên màn hình máy tính hay điện thoại khi thực phẩm trong tủ sắp đến hạn sử dụng!
              </p>
              {btnNotifPermission !== 'granted' && (
                <button
                  onClick={requestPushPermission}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 mt-1 uppercase tracking-wider"
                >
                  <Bell className="w-3 h-3 text-white" /> Bật thông báo đẩy ngay
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 py-1">
              {activeNotifications.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-xs flex flex-col items-center gap-1.5 animate-fade-in">
                  <span className="text-2xl">🎉</span>
                  <p className="font-bold text-zinc-700">Tủ lạnh sạch sẽ, an toàn!</p>
                  <p className="text-[10px] text-zinc-400">Không có cảnh báo hạn sử dụng hay thông báo chưa đọc.</p>
                </div>
              ) : (
                activeNotifications.map((notif) => {
                  let itemBg = 'bg-zinc-50 border-zinc-150';
                  let iconElement = <Info className="w-4 h-4 text-emerald-600" />;

                  if (notif.type === 'danger') {
                    itemBg = 'bg-red-50/40 border-red-100';
                    iconElement = <AlertTriangle className="w-4 h-4 text-red-600" />;
                  } else if (notif.type === 'warning') {
                    itemBg = 'bg-amber-50/40 border-amber-100';
                    iconElement = <AlertTriangle className="w-4 h-4 text-amber-600" />;
                  } else if (notif.type === 'success') {
                    itemBg = 'bg-emerald-50/30 border-emerald-100';
                    iconElement = <Check className="w-4 h-4 text-emerald-600" />;
                  }

                  return (
                    <div 
                      key={notif.id}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border ${itemBg} text-left relative group transition-all`}
                    >
                      <div className="pt-0.5">{iconElement}</div>
                      <div className="flex-grow pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-[11px] text-zinc-800 leading-tight">
                            {notif.title}
                          </span>
                          <span className="text-[8px] font-black uppercase text-zinc-400 bg-white/70 px-1 rounded border">
                            {notif.timestamp}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1 leading-normal font-medium">
                          {notif.description}
                        </p>
                      </div>
                      <button
                        onClick={() => setDismissedNotifIds(prev => [...prev, notif.id])}
                        className="absolute top-2 right-2 p-0.5 rounded-full text-zinc-400 hover:text-zinc-650 hover:bg-zinc-200/55 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                        title="Đánh dấu đã đọc"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-100">
              {activeNotifications.length > 0 && (
                <button
                  onClick={() => {
                    const ids = activeNotifications.map(n => n.id);
                    setDismissedNotifIds(prev => [...prev, ...ids]);
                  }}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Đọc hết
                </button>
              )}
              <button
                onClick={() => setShowNotifPopup(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer text-center"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
