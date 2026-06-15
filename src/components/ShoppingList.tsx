import { useState, FormEvent, useMemo } from 'react';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Package, 
  ShieldAlert, 
  Sparkles, 
  Check, 
  Search, 
  CheckCircle2, 
  Sparkle,
  X,
  PlusCircle,
  Egg,
  Beef,
  Apple,
  CheckSquare,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingItem } from '../types';
import { translateIngredientName } from '../utils/translation';

interface ShoppingListProps {
  shoppingList: ShoppingItem[];
  onAddShoppingItem: (item: { name: string; category?: string; quantity?: string }) => Promise<void>;
  onToggleShoppingItem: (id: number, checked: boolean) => Promise<void>;
  onClearShoppingList: () => Promise<void>;
  onAddBatchToShopping: (items: { name: string; category: string; quantity: string }[]) => Promise<void>;
}

export default function ShoppingList({
  shoppingList,
  onAddShoppingItem,
  onToggleShoppingItem,
  onClearShoppingList,
  onAddBatchToShopping
}: ShoppingListProps) {
  
  // Tab control inside shopping view (combos vs personal tracker)
  const [activeTab, setActiveTab] = useState<'checklist' | 'combos'>('checklist');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Custom manual item addition state
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Đạm');
  const [customQty, setCustomQty] = useState('1 phần');

  // Pool of Vietnamese culinary and supply combos
  const ALL_COMBOS = useMemo(() => [
    {
      id: 'essential',
      title: 'Combo Thiết Yếu Gia Đình',
      description: 'Linh hoạt, tiết kiệm, tiện lợi cho các món chiên xào hằng ngày đầy ụ protein.',
      badge: 'Dinh Dưỡng Cao',
      bgEmoji: '🌱',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
      items: [
        { id: 'eggs', name: 'Trứng Gà Hữu Cơ (12 quả)', category: 'Cơ bản', qty: '1 vỉ', label: 'Dinh dưỡng' },
        { id: 'tofu', name: 'Đậu Hũ Non Sạch (400g)', category: 'Tươi sống', qty: '1 hộp' },
        { id: 'pork', name: 'Thịt Heo Nạc Thơm Băm (500g)', category: 'Đạm', qty: '1 khay', label: 'Đạm tươi' }
      ]
    },
    {
      id: 'bbq',
      title: 'Combo Tiệc Lẩu Nướng Cuối Tuần',
      description: 'Đậm vị và thơm nức với các nguyên liệu cao cấp, thích hợp làm tiệc nướng sườn hoặc lẩu bò tụ tập cùng bạn bè hân hoan.',
      badge: 'Tiệc Cuối Tuần',
      bgEmoji: '🍽️',
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80',
      items: [
        { id: 'beef', name: 'Bắp Bò Mỹ Đông Lạnh (1kg)', category: 'Đông lạnh', qty: '1 khay', label: 'Đông lạnh' },
        { id: 'bbq', name: 'Nước Sốt BBQ Ướp Sườn (Chai)', category: 'Gia vị', qty: '1 chai' },
        { id: 'potatoes', name: 'Khoai Tây Vàng Đà Lạt (Túi 2kg)', category: 'Tươi sống', qty: '1 túi' }
      ]
    },
    {
      id: 'refresh',
      title: 'Combo Thanh Nhiệt Ngày Hè',
      description: 'Giúp giải nhiệt mùa nóng bức tuyệt đỉnh với mâm canh ngon mướt từ rau sạch vườn nhà kết hợp thịt băm ngọt nước.',
      badge: 'Thanh Mát Giải Nhiệt',
      bgEmoji: '🥗',
      imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
      items: [
        { id: 'water_spinach', name: 'Rau Muống Sạch Côn Đảo (500g)', category: 'Rau củ', qty: '1 bó', label: 'Tươi mát' },
        { id: 'tomato', name: 'Cà Chua Chín Hữu Cơ (1kg)', category: 'Rau củ', qty: '1 túi' },
        { id: 'ground_pork', name: 'Thịt Heo Băm Sạch Sẵn (500g)', category: 'Đạm', qty: '1 khay' }
      ]
    },
    {
      id: 'seafood',
      title: 'Combo Hải Sản Lai Rai Đổi Gió',
      description: 'Đổi gió mâm cơm gia đình chuẩn vị mồi bén cực chất với mực trứng Côn Đảo xào sa tế sả thơm cay ngất ngây.',
      badge: 'Hải Sản Tươi Sống',
      bgEmoji: '🍻',
      imageUrl: 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=500&auto=format&fit=crop&q=80',
      items: [
        { id: 'squid', name: 'Mực Trứng Sạch Côn Đảo (500g)', category: 'Đạm', qty: '1 khay', label: 'Hải sản' },
        { id: 'onion', name: 'Hành Tây Trắng Đà Lạt (1kg)', category: 'Rau củ', qty: '1 túi' },
        { id: 'sate', name: 'Sốt Sa Tế Cay Thơm Hảo Hạng', category: 'Gia vị', qty: '1 hũ' }
      ]
    },
    {
      id: 'baby',
      title: 'Combo Ăn Dặm Đầy Đủ Cho Bé',
      description: 'Cung cấp trọn vẹn chất xơ, vitamin bổ dưỡng từ bí đỏ vàng và súp lơ xanh hữu cơ lành tính cho bé yêu khôn lớn.',
      badge: 'Bé Khỏe Mẹ Vui',
      bgEmoji: '👶',
      imageUrl: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&auto=format&fit=crop&q=80',
      items: [
        { id: 'broccoli', name: 'Súp Lơ Xanh Organic (500g)', category: 'Rau củ', qty: '1 cái', label: 'Hữu cơ' },
        { id: 'pumpkin', name: 'Bí Đỏ Tròn Ba Vì (1kg)', category: 'Rau củ', qty: '1 quả' },
        { id: 'chicken', name: 'Ức Gà Phi Lê Tươi Sạch (500g)', category: 'Đạm', qty: '1 khay', label: 'Siêu nạc' }
      ]
    }
  ], []);

  const WEEKDAY_COMBO_IDS = useMemo<Record<number, string[]>>(() => ({
    0: ['bbq', 'baby'],      // Chủ nhật
    1: ['essential', 'refresh'], // Thứ hai
    2: ['essential', 'seafood'], // Thứ ba
    3: ['refresh', 'baby'],      // Thứ tư
    4: ['essential', 'bbq'],     // Thứ năm
    5: ['seafood', 'refresh'],   // Thứ sáu
    6: ['bbq', 'baby']        // Thứ bảy
  }), []);

  const WEEKDAY_NAMES = useMemo(() => [
    'Chủ Nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy'
  ], []);

  const [currentDayIndex] = useState(() => new Date().getDay());
  
  // Weekly default combos
  const [selectedComboIds, setSelectedComboIds] = useState<string[]>(() => {
    return WEEKDAY_COMBO_IDS[currentDayIndex] || ['essential', 'bbq'];
  });

  // Track checked items for each combo
  const [checkedItemsState, setCheckedItemsState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ALL_COMBOS.forEach(combo => {
      combo.items.forEach(item => {
        initial[`${combo.id}-${item.id}`] = true;
      });
    });
    return initial;
  });

  const [addedMessage, setAddedMessage] = useState(false);

  // Filter current displayed combos based on state ID
  const displayedCombos = useMemo(() => {
    return ALL_COMBOS.filter(c => selectedComboIds.includes(c.id));
  }, [selectedComboIds, ALL_COMBOS]);

  const toggleComboItem = (comboId: string, itemId: string) => {
    const key = `${comboId}-${itemId}`;
    setCheckedItemsState(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleShuffleCombos = () => {
    const ids = ALL_COMBOS.map(c => c.id);
    const shuffled = [...ids].sort(() => 0.5 - Math.random());
    setSelectedComboIds(shuffled.slice(0, 2));
  };

  const handleAddBundleToCart = async () => {
    const itemsToAdd: { name: string; category: string; quantity: string }[] = [];
    
    displayedCombos.forEach(combo => {
      combo.items.forEach(item => {
        const key = `${combo.id}-${item.id}`;
        if (checkedItemsState[key]) {
          itemsToAdd.push({ name: item.name, category: item.category, quantity: item.qty });
        }
      });
    });

    if (itemsToAdd.length === 0) return;

    await onAddBatchToShopping(itemsToAdd);
    setAddedMessage(true);
    setTimeout(() => {
      setAddedMessage(false);
      // Automatically switch to checklist tab so user sees new items
      setActiveTab('checklist');
    }, 1500);
  };

  const handleCustomAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    
    await onAddShoppingItem({
      name: customName.trim(),
      category: customCategory,
      quantity: customQty
    });

    setCustomName('');
    setCustomQty('1 phần');
  };

  // Pre-configured category pickers for custom addition
  const categoriesList = [
    { name: 'Đạm', icon: '🥩', bg: 'bg-rose-50 text-rose-700 border-rose-150' },
    { name: 'Rau củ', icon: '🥦', bg: 'bg-emerald-50 text-emerald-700 border-emerald-150' },
    { name: 'Gia vị', icon: '🧂', bg: 'bg-amber-50 text-amber-700 border-amber-150' },
    { name: 'Bơ Sữa', icon: '🥛', bg: 'bg-blue-50 text-blue-700 border-blue-150' },
    { name: 'Khác', icon: '🍳', bg: 'bg-zinc-50 text-zinc-700 border-zinc-150' },
  ];

  // Calculate statistics for dynamic updates
  const totalItems = shoppingList.length;
  const checkedItems = shoppingList.filter(i => i.is_checked).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  // Filter shopping list based on search query
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return shoppingList;
    return shoppingList.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [shoppingList, searchTerm]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="shopping-view">
      
      {/* Dynamic Layout Tabs */}
      <div className="bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200/60 flex gap-1 relative overflow-hidden" id="shopping-segmented-tabs">
        {[
          { id: 'checklist', label: 'Sổ Tây Đi Chợ', emoji: '🛒', badge: totalItems > 0 ? `${checkedItems}/${totalItems}` : undefined },
          { id: 'combos', label: 'Gợi Ý Combo Dự Phòng', emoji: '📦', badge: 'Mới' }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'checklist' | 'combos')}
              className={`flex-1 relative py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 sm:gap-2 transition-all z-10 cursor-pointer outline-none select-none ${
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeShoppingTab"
                  className="absolute inset-0 bg-emerald-600 rounded-xl shadow-xs"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  style={{ originY: '0px' }}
                />
              )}
              <span className="relative z-20 text-xs sm:text-sm">{tab.emoji}</span>
              <span className="relative z-20 text-[11px] sm:text-xs">{tab.label}</span>
              {tab.badge && (
                <span className={`relative z-20 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold leading-none transition-colors ${
                  isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-zinc-200 text-zinc-500'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'checklist' ? (
          /* =================== TAB 1: SHOPPING CHECKLIST =================== */
          <motion.div
            key="checklist-content"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6"
          >
            {/* Elegant Tracker Header & Clean stats */}
            <section className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-xs">
              <div className="flex justify-between items-start gap-4 flex-wrap pb-4 border-b border-zinc-100">
                <div>
                  <h3 className="font-extrabold text-zinc-900 text-sm uppercase tracking-wide flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Tiến độ chuẩn bị
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-semibold tracking-wide uppercase mt-1 leading-relaxed">
                    Hữu ích cho các mâm cơm được chuẩn vị trọn vẹn
                  </p>
                </div>
                {totalItems > 0 && (
                  <button 
                    onClick={onClearShoppingList}
                    className="text-red-600 hover:bg-red-50 hover:border-red-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-transparent cursor-pointer transition-all active:scale-95 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Đặt lại giỏ hàng
                  </button>
                )}
              </div>

              {/* Progress Percentage & Interactive Line Loader */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-extrabold text-zinc-700">
                  <span>Tỉ lệ đã gom đủ nguyên liệu</span>
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-black">{progressPercent}%</span>
                </div>
                <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-emerald-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                  />
                </div>
                <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest mt-1 text-right">
                  Đồng bộ tức thì lên tủ lạnh khi hoàn tất
                </p>
              </div>
            </section>

            {/* Shopping List Table Card */}
            <section className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex flex-col gap-4">
              
              {/* Checklist Search & Quick Filters */}
              {totalItems > 0 && (
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-zinc-400" />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm nhanh nguyên liệu trong sổ..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all placeholder-zinc-400"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {/* List Content */}
              {filteredList.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs space-y-2 flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
                  <ShoppingCart className="w-12 h-12 text-zinc-300 stroke-1 animate-bounce" />
                  <p className="font-extrabold text-zinc-700 text-sm">
                    {searchTerm ? "Không có kết quả khớp với tìm kiếm" : "Giỏ hàng đi chợ của bạn trống"}
                  </p>
                  <p className="max-w-xs text-zinc-400/90 leading-relaxed text-[10px] font-semibold">
                    {searchTerm ? "Thử gõ một từ khóa khác hoặc dọn dẹp bộ lọc." : "Hãy chọn gói 'Gợi Ý Combo Dự Phòng' ở tab phía trên hoặc thêm tay ở form bên dưới."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1 no-scrollbar">
                  <AnimatePresence>
                    {filteredList.map((item) => (
                      <motion.div 
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => onToggleShoppingItem(item.id, !item.is_checked)}
                        className={`flex items-start gap-3.5 p-3.5 rounded-2xl cursor-pointer border select-none transition-all ${
                          item.is_checked 
                            ? 'bg-zinc-50/70 border-zinc-200 opacity-60 text-zinc-400 hover:opacity-80' 
                            : 'bg-emerald-50/10 border-zinc-200 hover:border-emerald-200 text-zinc-800 hover:bg-emerald-50/30 shadow-2xs'
                        }`}
                      >
                        {item.is_checked ? (
                          <div className="w-5 h-5 rounded bg-zinc-200 flex items-center justify-center mt-0.5 flex-shrink-0 border border-zinc-300 transition-colors">
                            <Check className="w-3.5 h-3.5 text-zinc-650 font-black" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded bg-white hover:border-emerald-500 border border-zinc-300 mt-0.5 flex-shrink-0 transition-all active:scale-90" />
                        )}
                        <div className="flex-grow text-xs font-bold flex flex-col">
                          <span className={item.is_checked ? "line-through text-zinc-450 font-medium" : "text-zinc-800"}>
                            {translateIngredientName(item.name)}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[8.5px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                              item.is_checked 
                                ? 'bg-zinc-200 text-zinc-500' 
                                : 'bg-zinc-100 text-zinc-600'
                            }`}>
                              {item.category || 'Mặc định'}
                            </span>
                            <span className="text-[9.5px] text-zinc-400 font-semibold">• SL: {item.quantity || '1 gói'}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Redesigned Manual Addition Form with Smart Shortcuts */}
              <div className="mt-5 pt-5 border-t border-zinc-150 flex flex-col gap-5 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                      Thêm nguyên liệu thông minh
                    </h4>
                    <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wide mt-0.5">
                      Chọn danh mục để xem gợi ý siêu tốc cực kỳ tiện dụng
                    </p>
                  </div>
                </div>

                {/* Category Picker Chips */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {categoriesList.map((cat) => {
                      const isSelected = customCategory === cat.name;
                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => {
                            setCustomCategory(cat.name);
                          }}
                          className={`px-3 py-2 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-all border outline-none select-none ${
                            isSelected 
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs scale-102 font-black' 
                              : `bg-zinc-50 text-zinc-650 border-zinc-200/80 hover:bg-zinc-100 hover:text-zinc-900`
                          }`}
                        >
                          <span className="text-[11px]">{cat.icon}</span>
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Smart Category-Based suggestion shortcuts (One-click quick commits) */}
                <div className="bg-zinc-55 p-3.5 rounded-2xl border border-zinc-200/60 text-left space-y-2.5">
                  <span className="text-[9.5px] font-black text-zinc-400 uppercase tracking-widest block">
                    ⚡ Gợi ý siêu tốc ({customCategory}):
                  </span>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {(customCategory === 'Đạm' ? [
                      { name: 'Thịt ba chỉ heo', qty: '500g' },
                      { name: 'Bắp bò tươi', qty: '400g' },
                      { name: 'Ức gà phi lê', qty: '500g' },
                      { name: 'Trứng gà sạch', qty: '1 vỉ' },
                      { name: 'Cá thác lác băm', qty: '300g' }
                    ] : customCategory === 'Rau củ' ? [
                      { name: 'Rau muống non', qty: '1 bó' },
                      { name: 'Hành lá tươi cỏ', qty: '1 lạng' },
                      { name: 'Cà chua Đà Lạt', qty: '500g' },
                      { name: 'Tỏi củ Lý Sơn', qty: '1 túi' },
                      { name: 'Bông cải xanh', qty: '1 cái' }
                    ] : customCategory === 'Gia vị' ? [
                      { name: 'Hạt nêm thịt thăn', qty: '1 gói' },
                      { name: 'Nước mắm nhỉ', qty: '1 chai' },
                      { name: 'Sốt sa tế cay', qty: '1 hũ' },
                      { name: 'Tiêu Đen xay mịn', qty: '1 hũ' },
                      { name: 'Dầu hào đậm đặc', qty: '1 chai' }
                    ] : customCategory === 'Bơ Sữa' ? [
                      { name: 'Đậu hũ non sạch', qty: '1 hộp' },
                      { name: 'Đậu hũ chiên sẵn', qty: '3 miếng' },
                      { name: 'Nước cốt dừa thơm', qty: '1 hộp' },
                      { name: 'Sữa tươi sạch', qty: '1 hộp' }
                    ] : [
                      { name: 'Mì gói ăn liền', qty: '5 gói' },
                      { name: 'Bún tươi sợi nhỏ', qty: '1 kg' },
                      { name: 'Nấm đùi gà', qty: '300g' },
                      { name: 'Bánh mì đặc ruột', qty: '3 ổ' }
                    ]).map((shortcut, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={async () => {
                          await onAddShoppingItem({
                            name: shortcut.name,
                            category: customCategory,
                            quantity: shortcut.qty
                          });
                        }}
                        className="bg-white hover:bg-emerald-50 border border-zinc-200 hover:border-emerald-300 text-zinc-700 hover:text-emerald-800 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-3xs"
                      >
                        <span>🌱</span>
                        <span>{shortcut.name} ({shortcut.qty})</span>
                        <Plus className="w-2.5 h-2.5 text-zinc-400 group-hover:text-emerald-600 ml-0.5 stroke-[3]" />
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCustomAdd} className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    {/* Item Name Input */}
                    <div className="sm:col-span-6 relative">
                      <input 
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Nhập tên nguyên liệu khác cần mua..."
                        className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white transition-all placeholder-zinc-450"
                        required
                      />
                    </div>
                    
                    {/* Quantity Input */}
                    <div className="sm:col-span-3">
                      <input 
                        type="text"
                        value={customQty}
                        onChange={(e) => setCustomQty(e.target.value)}
                        placeholder="SL (ví dụ: 1 túi, 500g)"
                        className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white transition-all text-center placeholder-zinc-400"
                        required
                      />
                    </div>

                    {/* Add button */}
                    <div className="sm:col-span-3">
                      <button 
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all outline-none font-bold text-xs cursor-pointer active:scale-97 shadow-xs font-black uppercase tracking-wider"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Thêm Tay</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>
          </motion.div>
        ) : (
          /* =================== TAB 2: COMBOS RESTOCK =================== */
          <motion.div
            key="combos-content"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6"
          >
            {/* Dynamic Status / Shuffle Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-50 p-4.5 rounded-3xl border border-zinc-200">
              <div className="flex items-center gap-2 text-left">
                <span className="text-xl">📅</span>
                <div>
                  <span className="text-[11px] font-extrabold text-zinc-800 block">Lịch trình hôm nay ({WEEKDAY_NAMES[currentDayIndex]})</span>
                  <span className="text-[9.5px] text-emerald-700 font-extrabold uppercase bg-emerald-50 px-1.5 py-0.5 rounded">Gợi ý tự động cập nhật theo ngày</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleShuffleCombos}
                className="bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 hover:border-zinc-400 font-bold text-[10px] px-3.5 py-2.5 rounded-xl uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
              >
                <span>🔄</span>
                <span>Đổi Gợi Ý Ngẫu Nhiên</span>
              </button>
            </div>

            {/* Warning Banner */}
            <section className="bg-amber-50 text-amber-800 p-4 rounded-3xl flex items-start gap-3.5 border border-amber-200 shadow-2xs">
              <ShieldAlert className="w-5.5 h-5.5 text-amber-500 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1 text-left">
                <p className="text-[11px] font-black leading-relaxed text-amber-900 uppercase tracking-wider">
                  Tủ Lạnh Đang Trống ~80%
                </p>
                <p className="text-[10px] font-bold leading-relaxed text-amber-800/95">
                  Dưới đây là các combo nguyên liệu dự phòng chất lượng cao giúp hồi sinh nhà bếp đầy ắp thịt cá rau xanh chỉ trong 1 lần bổ sung.
                </p>
              </div>
            </section>

            {/* Grid containing the Bundle cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayedCombos.map((combo) => (
                <article key={combo.id} className="bg-white rounded-3xl border border-zinc-200 overflow-hidden flex flex-col justify-between shadow-xs group hover:shadow-md transition-shadow">
                  <div>
                    <div className="h-40 w-full relative bg-zinc-50 overflow-hidden">
                      <img 
                        alt={combo.title} 
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        src={combo.imageUrl}
                      />
                      <div className="absolute top-3 right-3 bg-emerald-600/95 text-white px-3 py-1 rounded-full font-extrabold text-[9px] uppercase tracking-wider shadow-sm flex items-center gap-1 backdrop-blur-xs">
                        {combo.id === 'refresh' || combo.id === 'essential' ? (
                          <Sparkles className="w-3 h-3 text-emerald-300 animate-pulse" />
                        ) : (
                          <span>{combo.bgEmoji}</span>
                        )} 
                        {combo.badge}
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <div>
                        <h3 className="font-extrabold text-base text-zinc-900 text-left">{combo.title}</h3>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed font-semibold text-left">
                          {combo.description}
                        </p>
                      </div>

                      <div className="pt-1">
                        <h4 className="font-bold text-[9px] uppercase tracking-widest text-zinc-400 mb-2.5 flex items-center gap-1.5 matches-heading">
                          📦 CHI TIẾT GÓI NGUYÊN LIỆU:
                        </h4>
                        <div className="space-y-2">
                          {combo.items.map((it) => {
                            const isChecked = !!checkedItemsState[`${combo.id}-${it.id}`];
                            return (
                              <div 
                                key={it.id}
                                onClick={() => toggleComboItem(combo.id, it.id)}
                                className={`flex items-center gap-3 p-2.5 rounded-2xl border cursor-pointer select-none transition-all ${
                                  isChecked 
                                    ? 'bg-emerald-50/15 border-emerald-500/30' 
                                    : 'bg-zinc-50 border-zinc-200/50 opacity-60'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4.5 h-4.5 text-emerald-600 fill-emerald-500/10 flex-shrink-0" />
                                ) : (
                                  <Square className="w-4.5 h-4.5 text-zinc-300 flex-shrink-0" />
                                )}
                                <div className="flex-grow flex flex-col text-left">
                                  <span className="text-[11px] font-bold text-zinc-800">{it.name}</span>
                                  <span className="text-[9px] font-semibold text-zinc-450">{it.category} • {it.qty}</span>
                                </div>
                                {it.label && (
                                  <span className="text-[8px] font-black tracking-wider uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                    {it.label}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* CTA ACTION FLOATING BAR */}
            <div className="bg-zinc-900 text-white rounded-3xl p-5 border border-zinc-800 shadow-xl flex flex-col gap-4 max-w-lg mx-auto w-full">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2.5">
                <div className="flex gap-2 items-center text-left">
                  <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                  <div>
                    <span className="font-extrabold text-xs block uppercase tracking-wide">Bổ Sung Gói Thực Phẩm Dự Phòng</span>
                    <span className="text-[10px] text-zinc-400 font-medium">Sẽ đồng bộ trực tiếp vào "Sổ Tay Đi Chợ" của bạn</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleAddBundleToCart}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer outline-none select-none"
              >
                {addedMessage ? (
                  <>
                    <Check className="p-0.5 w-4.5 h-4.5 text-emerald-100 bg-emerald-800 rounded-full animate-bounce" />
                    <span>ĐÃ THÊM VÀO SỔ ĐI CHỢ THÀNH CÔNG!</span>
                  </>
                ) : (
                  <>
                    <span>THÊM COMBO ĐÃ CHỌN VÀO GIỎ</span> 
                    <ShoppingCart className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
