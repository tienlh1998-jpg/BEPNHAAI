import { useState } from 'react';
import { 
  Sparkles, Clock, Heart, BookOpen, AlertTriangle, ChevronRight, X, CheckSquare, PlusCircle, Check, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Recipe } from '../types';
import { translateIngredientName } from '../utils/translation';

interface RecipeMatchingProps {
  recipes: Recipe[];
  cookedRecipes: Recipe[];
  onRefreshRecipes: () => Promise<void>;
  onTriggerGeminiMatch: (category?: string) => Promise<Recipe[] | null>;
  onAddMissingToShopping: (items: string[]) => Promise<void>;
}

export default function RecipeMatching({
  recipes,
  cookedRecipes = [],
  onRefreshRecipes,
  onTriggerGeminiMatch,
  onAddMissingToShopping
}: RecipeMatchingProps) {
  const [activeCategory, setActiveCategory] = useState<'new' | 'cooked' | 'favorite'>('new');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('chef_pantry_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchStep, setMatchStep] = useState('');
  const [justAddedShopping, setJustAddedShopping] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Recipe[]>([]);
  
  const [cookingActive, setCookingActive] = useState(false);
  const [cookingSuccess, setCookingSuccess] = useState(false);

  const [substitutes, setSubstitutes] = useState<Record<string, any[]>>({});
  const [isLoadingSubstitutes, setIsLoadingSubstitutes] = useState(false);
  const [substituteError, setSubstituteError] = useState<string | null>(null);

  // Custom confirmation modal states to bypass iframe/sandbox window.confirm/alert blocks
  const [deleteCookedId, setDeleteCookedId] = useState<number | null>(null);
  const [deleteRecipeName, setDeleteRecipeName] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFetchSubstitutes = async (recipeName: string, missing: string[]) => {
    try {
      setIsLoadingSubstitutes(true);
      setSubstituteError(null);
      const res = await fetch('/api/ai-substitutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipeName, missingIngredients: missing })
      });
      if (!res.ok) throw new Error('Could not fetch substitutes.');
      const data = await res.json();
      if (data.success && data.suggestions) {
        setSubstitutes(prev => ({
          ...prev,
          [recipeName]: data.suggestions
        }));
      } else {
        throw new Error(data.error || 'Failed to fetch');
      }
    } catch (err: any) {
      console.error(err);
      setSubstituteError('Không thể lấy gợi ý AI lúc này. Vui lòng thử lại.');
    } finally {
      setIsLoadingSubstitutes(false);
    }
  };

  const handleDeleteCooked = (id: number, name: string) => {
    setDeleteCookedId(id);
    setDeleteRecipeName(name);
  };

  const executeDeleteCooked = async () => {
    if (!deleteCookedId) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/cooked-recipes/${deleteCookedId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete history item');
      const data = await res.json();
      if (data.success) {
        await onRefreshRecipes();
        setDeleteCookedId(null);
        setDeleteRecipeName('');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const executeClearAllCooked = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch('/api/cooked-recipes', {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to clear cooked history');
      const data = await res.json();
      if (data.success) {
        await onRefreshRecipes();
        setShowClearConfirm(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleFavorite = (recipeName: string) => {
    const exists = favorites.some(fav => fav.toLowerCase().trim() === recipeName.toLowerCase().trim());
    const updated = exists
      ? favorites.filter(fav => fav.toLowerCase().trim() !== recipeName.toLowerCase().trim())
      : [...favorites, recipeName];
    setFavorites(updated);
    try {
      localStorage.setItem('chef_pantry_favorites', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving favorite status:', e);
    }
  };

  const handleStartCooking = async (recipe: Recipe) => {
    try {
      setCookingActive(true);
      const res = await fetch('/api/consumption/cook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipeName: recipe.name,
          ingredients: recipe.ingredientsNeeded || [],
          recipe: recipe
        })
      });
      if (res.ok) {
        setCookingSuccess(true);
        // Clear this suggestion from AI Suggestions once cooked
        setAiSuggestions(prev => prev.filter(r => r.name !== recipe.name));
        await onRefreshRecipes();
        setTimeout(() => {
          setCookingSuccess(false);
          setSelectedRecipe(null);
        }, 2200);
      } else {
        setSelectedRecipe(null);
      }
    } catch (e) {
      console.error('Cooking failed:', e);
      setSelectedRecipe(null);
    } finally {
      setCookingActive(false);
    }
  };

  const startMatchingForCategory = async (vCategory: 'Cơm nhà' | 'Món nhậu' | 'Ăn dặm cho bé', clientCategory: 'Family Meals' | 'Pub Mates' | 'Baby Weaning') => {
    setShowOptions(false);
    setIsMatching(true);
    setJustAddedShopping([]);
    
    const dynamicSteps = [
      `Khởi động luồng ẩm thực Gemini AI cho "${vCategory}"...`,
      "Đọc danh sách nguyên liệu và đạm khả dụng tủ lạnh...",
      `Tìm kiếm công thức nấu món "${vCategory}" thơm dẻo bổ dưỡng...`,
      "Tính toán gia vị tỉ lệ vàng tinh tế...",
      "Tối ưu hóa thời lượng chế biến cùng bếp nhiệt điện...",
      "Hoàn tất soạn đĩa và dọn mâm cơm bốc khói mời gia đình!"
    ];

    let stepIndex = 0;
    setMatchStep(dynamicSteps[0]);
    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex < dynamicSteps.length) {
        setMatchStep(dynamicSteps[stepIndex]);
      }
    }, 850);

    try {
      const results = await onTriggerGeminiMatch(vCategory);
      if (results && results.length > 0) {
        setAiSuggestions(results);
      }
      setActiveCategory('new');
    } catch (err) {
      console.error(err);
    } finally {
      clearInterval(interval);
      setIsMatching(false);
    }
  };

  const handleAddMissing = async (items: string[]) => {
    const translatedItems = items.map(translateIngredientName);
    await onAddMissingToShopping(translatedItems);
    setJustAddedShopping(prev => [...prev, ...items]);
  };

  // Convert categories back and forth for Vietnamese translations if needed
  const renderCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Family Meals': return '🏡';
      case 'Pub Mates': return '🍻';
      case 'Baby Weaning': return '👶';
      case 'Cơm nhà': return '🏡';
      case 'Món nhậu': return '🍻';
      case 'Ăn dặm cho bé': return '👶';
      default: return '🍳';
    }
  };

  // Get cooked recipe names to identify if a recipe has been cooked
  const cookedNames = new Set(cookedRecipes.map(c => c.name.toLowerCase().trim()));

  // Construct a base of all recipes (including general, cooked/scanned, and recommended AI options)
  const allAvailableRecipes: any[] = [...recipes];
  
  cookedRecipes.forEach(cooked => {
    if (!allAvailableRecipes.some(r => r.name.toLowerCase().trim() === cooked.name.toLowerCase().trim())) {
      allAvailableRecipes.push({
        id: cooked.id,
        name: cooked.name,
        category: cooked.category as any,
        cooking_time_min: cooked.cooking_time_min,
        image_url: cooked.image_url,
        instructions: cooked.instructions,
        ingredientsNeeded: cooked.ingredientsNeeded,
        missingIngredients: [],
        description: cooked.instructions.split('\n')[0] || 'Món ăn yêu thích đã được ghi nhận.'
      });
    }
  });

  aiSuggestions.forEach(sug => {
    if (!allAvailableRecipes.some(r => r.name.toLowerCase().trim() === sug.name.toLowerCase().trim())) {
      allAvailableRecipes.push(sug);
    }
  });

  // Calculate high-fidelity valid favorites currently present in the dataset
  const validFavorites = allAvailableRecipes.filter(r => 
    favorites.some(fav => fav.toLowerCase().trim() === r.name.toLowerCase().trim())
  );

  // Setup list based on tab
  let displayRecipes: any[] = [];

  if (activeCategory === 'new') {
    // Uncooked recipes inside general recipes
    const uncookedCurated = recipes.filter(r => !cookedNames.has(r.name.toLowerCase().trim()));
    
    // Merge general uncooked and Gemini temporary AI suggestions, avoiding duplicates
    const combined = [...aiSuggestions];
    uncookedCurated.forEach(r => {
      if (!combined.some(ai => ai.name.toLowerCase().trim() === r.name.toLowerCase().trim())) {
        combined.push(r);
      }
    });

    displayRecipes = combined.sort((a, b) => (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0));
  } else if (activeCategory === 'cooked') {
    // Group cooked recipes by case-insensitive name to prevent duplicates
    const cookedMap = new Map<string, any>();
    cookedRecipes.forEach(cr => {
      const key = cr.name.toLowerCase().trim();
      const existing = cookedMap.get(key);
      if (existing) {
        existing.cook_count = (existing.cook_count || 1) + 1;
        if (cr.cooked_at && (!existing.cooked_at || cr.cooked_at > existing.cooked_at)) {
          existing.cooked_at = cr.cooked_at;
        }
      } else {
        cookedMap.set(key, {
          ...cr,
          is_cooked: true,
          cook_count: 1
        });
      }
    });
    displayRecipes = Array.from(cookedMap.values()).reverse();
  } else if (activeCategory === 'favorite') {
    displayRecipes = validFavorites;
  }

  return (
    <div id="recipe-view" className="relative">
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Header Section */}
        <section className="flex justify-between items-center bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs">
        <div>
          <h1 className="text-lg font-black tracking-tight text-zinc-900 leading-none">Hôm Nay Ăn Gì Thưa Chef?</h1>
          <p className="text-[11px] font-semibold text-zinc-400 mt-1.5 uppercase tracking-wide">Khám phá công thức mới qua trợ lý AI hoặc xem lịch sử mâm cơm</p>
        </div>
        <button
          onClick={() => setShowOptions(true)}
          disabled={isMatching}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-200 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-white animate-spin-slow" /> Menu Gemini AI
        </button>
      </section>

      {/* AI DESIGNED RECOMMENDATIONS - POPULATES ONLY WHEN DYNAMICALLY MATCHED WITH GEMINI */}
      {aiSuggestions.length > 0 && activeCategory !== 'new' && (
        <section className="bg-emerald-900 text-white rounded-3xl p-5 shadow-sm border border-emerald-800 space-y-4 animate-scale-up">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-300 animate-pulse" />
              <h2 className="font-extrabold text-sm tracking-tight text-emerald-100">Gợi Ý Mâm Cơm AI Mới Nhất Dành Cho Bạn</h2>
            </div>
            <button 
              onClick={() => setAiSuggestions([])}
              className="p-1 rounded-full bg-emerald-850/60 text-emerald-200 hover:text-white transition-colors"
              title="Ẩn gợi ý này"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiSuggestions.map((recipe) => (
              <div key={recipe.id} className="bg-emerald-950/40 rounded-2xl p-4 border border-emerald-800/60 flex gap-4 items-center justify-between">
                <div className="flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-emerald-950 flex-shrink-0">
                    <img 
                      src={recipe.image_url} 
                      alt={recipe.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-emerald-55 leading-tight">{recipe.name}</h3>
                    <p className="text-[10px] text-emerald-300/80 mt-1 flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" /> {recipe.cooking_time_min} Phút • {recipe.ingredientsNeeded?.length || 0} n.liệu
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavorite(recipe.name)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white active:scale-95 transition-all cursor-pointer"
                    title="Yêu thích"
                  >
                    <Heart className={`w-4 h-4 ${favorites.includes(recipe.name) ? 'fill-red-500 text-red-500' : 'text-emerald-300'}`} />
                  </button>
                  <button 
                    onClick={() => setSelectedRecipe(recipe)}
                    className="bg-white hover:bg-emerald-100 text-emerald-950 font-extrabold px-3.5 py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  >
                    Chọn Nấu
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category Tabs Section Header */}
      <div>
        <h2 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider pl-1 flex items-center gap-2">
          <span>📋</span> Danh Mục Thực Đơn Cơm Bếp
        </h2>
      </div>

      {/* Category Tabs & Segmented Control */}
      <div className="bg-zinc-100 p-1 rounded-2xl border border-zinc-200/80 flex gap-1 items-center relative overflow-hidden" id="pantry-tabs-container">
        {[
          { id: 'new', label: 'Gợi Ý Mới', emoji: '🌱', count: recipes.filter(r => !cookedNames.has(r.name.toLowerCase().trim())).length + aiSuggestions.length },
          { id: 'cooked', label: 'Đã Nấu', emoji: '🍲', count: new Set(cookedRecipes.map(c => c.name.toLowerCase().trim())).size },
          { id: 'favorite', label: 'Yêu thích', emoji: '💖', count: validFavorites.length }
        ].map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as 'new' | 'cooked' | 'favorite')}
              className={`flex-1 relative py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1 sm:gap-2 transition-all z-10 cursor-pointer outline-none select-none ${
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-emerald-600 rounded-xl shadow-xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  style={{ originY: '0px' }}
                />
              )}
              <span className="relative z-20 text-xs sm:text-sm">{tab.emoji}</span>
              <span className="relative z-20 whitespace-nowrap text-[11px] sm:text-xs">{tab.label}</span>
              <span className={`relative z-20 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold leading-none transition-colors ${
                isActive ? 'bg-emerald-700/80 text-emerald-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {activeCategory === 'cooked' && cookedRecipes.length > 0 && (
        <div className="flex justify-end mt-3 mb-1">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-[11px] font-black text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl px-3.5 py-2 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-3xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xoá toàn bộ lịch sử đã nấu</span>
          </button>
        </div>
      )}

      {/* Recipe Grid (Filtered History / New / Favorites) with AnimatePresence Page Transition */}
      <div className="relative min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-1"
          >
            {displayRecipes.length === 0 ? (
              <div className="col-span-full text-center py-16 bg-white border border-dashed border-zinc-200 rounded-3xl text-zinc-400 text-xs flex flex-col items-center justify-center gap-2.5 p-6 shadow-2xs">
                {activeCategory === 'new' ? (
                  <>
                    <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 animate-pulse">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <p className="font-extrabold text-zinc-700 text-sm mt-1">Chưa có gợi ý món ăn mới</p>
                    <p className="max-w-xs text-zinc-400 font-semibold leading-relaxed">Hãy ấn chọn "Menu Gemini AI" ở góc trên hoặc mua sắm nạp thêm nguyên liệu vào tủ lạnh của bạn!</p>
                  </>
                ) : activeCategory === 'cooked' ? (
                  <>
                    <div className="p-3 bg-zinc-50 rounded-full text-zinc-400">
                      <CheckSquare className="w-8 h-8" />
                    </div>
                    <p className="font-extrabold text-zinc-700 text-sm mt-1">Chưa nấu mâm cơm nào</p>
                    <p className="max-w-xs text-zinc-400 font-semibold leading-relaxed">Nhấn chọn "Menu Gemini AI" ở góc trên hoặc tìm gợi ý mới để nấu ngay bữa cơm chuẩn cơm mẹ nấu nhé!</p>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-red-50 rounded-full text-red-400 animate-pulse">
                      <Heart className="w-8 h-8 text-red-500 fill-red-500/20" />
                    </div>
                    <p className="font-extrabold text-zinc-700 text-sm mt-1">Chưa có món ăn yêu thích nào</p>
                    <p className="max-w-xs text-zinc-400 font-semibold leading-relaxed">Hãy chạm icon Trái Tim nằm ở góc bên phải bìa mỗi món ăn để lưu giữ món tủ hảo hạng!</p>
                  </>
                )}
              </div>
            ) : (
              displayRecipes.map((recipe, index) => {
                const isCooked = recipe.is_cooked || cookedNames.has(recipe.name.toLowerCase().trim());
                const isFavorited = favorites.some(fav => fav.toLowerCase().trim() === recipe.name.toLowerCase().trim());
                const missingCount = recipe.missingIngredients?.length ?? 0;
                const pct = recipe.matchPercentage ?? 100;

                let tagBg = "bg-emerald-50 text-emerald-700 border border-emerald-100";
                let tagText = `Khớp ${pct}%`;
                if (isCooked) {
                  tagBg = "bg-blue-50 text-blue-700 border border-blue-100";
                  tagText = "Đã Nấu";
                } else if (missingCount > 0) {
                  tagBg = "bg-amber-50 text-amber-700 border border-amber-100";
                  tagText = `Thiếu ${missingCount} n.liệu`;
                }

                return (
                  <motion.article 
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
                    key={`${recipe.name}-${recipe.id}`}
                    className="bg-white rounded-3xl shadow-xs border border-zinc-200 overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-md"
                  >
                    <div className="relative h-44 w-full bg-zinc-50 overflow-hidden">
                      <img 
                        alt={recipe.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                        referrerPolicy="no-referrer"
                        src={recipe.image_url || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80'}
                      />
                      
                      {/* Status Tag */}
                      <div className={`absolute top-4 left-4 ${tagBg} px-3 py-1 rounded-full flex items-center gap-1 shadow-xs backdrop-blur-md bg-opacity-95 text-[10px] uppercase tracking-wider font-extrabold`}>
                        {isCooked ? <Check className="w-3.5 h-3.5 text-blue-600 font-black" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />}
                        <span>{tagText}</span>
                      </div>

                      {/* Favorite Heart Overlaid on Right top corner of card */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(recipe.name);
                        }}
                        type="button"
                        className={`absolute top-4 ${activeCategory === 'cooked' ? 'right-14' : 'right-4'} p-2 bg-white/95 rounded-full shadow-md text-zinc-400 hover:text-red-500 hover:scale-110 active:scale-90 transition-all cursor-pointer backdrop-blur-xs z-10`}
                        title={isFavorited ? "Bỏ yêu thích" : "Yêu thích món này"}
                      >
                        <Heart className={`w-4 h-4 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : 'text-zinc-400'}`} />
                      </button>

                      {/* Delete from cooked history button */}
                      {activeCategory === 'cooked' && recipe.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCooked(recipe.id, recipe.name);
                          }}
                          type="button"
                          className="absolute top-4 right-4 p-2 bg-white/95 rounded-full shadow-md text-red-500 hover:text-red-700 hover:scale-110 active:scale-90 transition-all cursor-pointer backdrop-blur-xs z-10"
                          title="Xoá món khỏi lịch sử đã nấu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {recipe.cooked_at && (
                        <div className="absolute bottom-3 right-3 bg-zinc-900/85 text-zinc-200 px-2.5 py-1 rounded-lg text-[9px] font-mono tracking-wider flex items-center gap-1.5 backdrop-blur-xs">
                          <span>{recipe.cooked_at}</span>
                          {recipe.cook_count && recipe.cook_count > 1 && (
                            <span className="bg-emerald-600 text-white font-extrabold px-1 rounded text-[8px] uppercase tracking-wider py-0.5 ml-1 animate-pulse">
                              đã nấu {recipe.cook_count} lần
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex-grow flex flex-col justify-between">
                      <div>
                        <h3 className="font-extrabold text-base text-zinc-900 mb-1 flex items-center gap-1.5 line-clamp-1">
                          {recipe.name}
                        </h3>
                        <p className="text-[11px] leading-relaxed text-zinc-500 line-clamp-2 mb-4">
                          {recipe.description || recipe.instructions?.split('\n')[0] || 'Món ẩm thực ngon lành được chuẩn chuẩn vị Việt lành mạnh.'}
                        </p>
                        <div className="flex items-center gap-3 text-zinc-400 font-bold text-[10px] uppercase tracking-wider mb-4 border-t border-zinc-100 pt-3">
                          <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            {recipe.cooking_time_min} Phút
                          </span>
                          <span>•</span>
                          <span>{(recipe.ingredientsNeeded || []).length} Nguyên liệu</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => setSelectedRecipe(recipe)}
                        className="w-full bg-zinc-950 hover:bg-zinc-800 text-white py-3 rounded-2xl font-bold text-xs transition-all active:scale-98 shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isCooked ? "Xem Công Thức & Nấu Lại" : "Nấu Món Này"}
                      </button>
                    </div>
                  </motion.article>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      </div>

      {/* MATCHING SIMULATION OVERLAY */}
      {isMatching && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center flex flex-col items-center gap-4 border border-zinc-100">
            <div className="w-20 h-20 relative flex items-center justify-center bg-emerald-50 rounded-full border border-emerald-100">
              <span className="text-4xl animate-bounce">👨‍🍳</span>
              {/* Outer spinning ring */}
              <div className="absolute inset-0 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            </div>

            <div className="space-y-1">
              <h4 className="font-extrabold text-base text-zinc-900 uppercase tracking-wider">Gemini AI Kết Nối...</h4>
              <p className="text-[11px] leading-relaxed text-zinc-400 px-2 font-normal">
                Đầu bếp cấp cao đang đối chiếu dinh dưỡng tủ lạnh và chuẩn bị dọn mâm cơm đặc trưng phù hợp nhất!
              </p>
            </div>

            <div className="bg-zinc-900 text-emerald-400 p-4 rounded-2xl w-full border border-zinc-800 font-mono text-[9px] leading-relaxed text-left">
              <p className="animate-pulse">"{matchStep}"</p>
            </div>
          </div>
        </div>
      )}

      {/* SELECTION MODAL BEFORE MATCHING */}
      {showOptions && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-zinc-100 flex flex-col gap-4 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-xl text-emerald-600">
                  <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-sm text-zinc-900">Vạn Năng Gemini AI Matching</h3>
              </div>
              <button 
                onClick={() => setShowOptions(false)}
                className="p-1 rounded-full text-zinc-400 hover:bg-zinc-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Chọn Phong Cách Thực Đơn</label>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Hãy lựa chọn 1 trong 3 thực đơn ẩm thực dưới đây để đầu bếp Gemini AI phối hợp và tự động xuất mâm thức ăn tối ưu nhé!
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              {/* Option 1: Family Meals */}
              <button
                onClick={() => startMatchingForCategory("Cơm nhà", "Family Meals")}
                className="flex items-center gap-3.5 p-3.5 bg-zinc-50 hover:bg-emerald-50/50 border border-zinc-200 hover:border-emerald-200 rounded-2xl text-left transition-all active:scale-98 cursor-pointer group"
              >
                <span className="text-2xl">🏡</span>
                <div className="flex-grow">
                  <div className="font-extrabold text-xs text-zinc-800 group-hover:text-emerald-700 transition-colors">1. Cơm Nhà Truyền Thống</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5 leading-tight">Món kho mặn, canh rau thanh dạt và xào thơm lừng cho gia đình.</div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
              </button>

              {/* Option 2: Pub Mates */}
              <button
                onClick={() => startMatchingForCategory("Món nhậu", "Pub Mates")}
                className="flex items-center gap-3.5 p-3.5 bg-zinc-50 hover:bg-emerald-50/50 border border-zinc-200 hover:border-emerald-200 rounded-2xl text-left transition-all active:scale-98 cursor-pointer group"
              >
                <span className="text-2xl">🍻</span>
                <div className="flex-grow">
                  <div className="font-extrabold text-xs text-zinc-800 group-hover:text-emerald-700 transition-colors">2. Mồi Bén Cay Nồng</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5 leading-tight">Món nướng, sấy giòn sả ớt muối mặn, lai rai bia bọt cực bén dồi.</div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
              </button>

              {/* Option 3: Baby Weaning */}
              <button
                onClick={() => startMatchingForCategory("Ăn dặm cho bé", "Baby Weaning")}
                className="flex items-center gap-3.5 p-3.5 bg-zinc-50 hover:bg-emerald-50/50 border border-zinc-200 hover:border-emerald-200 rounded-2xl text-left transition-all active:scale-98 cursor-pointer group"
              >
                <span className="text-2xl">👶</span>
                <div className="flex-grow">
                  <div className="font-extrabold text-xs text-zinc-800 group-hover:text-emerald-700 transition-colors">3. Ăn Dặm Cho Bé (Baby)</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5 leading-tight">Bát súp láng mịn, bột gạo hầm, nấu bí đỏ lòng đỏ trứng rây tinh chế.</div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
              </button>
            </div>

            <div className="text-[9px] text-zinc-400 text-center pt-1 italic font-medium">
              * Quá trình kết nối & phân tích Gemini AI mất tầm 2-4 giây
            </div>
          </div>
        </div>
      )}

      {/* RECIPE DETAILS MODAL */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-scale-up border border-zinc-200">
            {/* Header Banner */}
            <div className="relative h-44 w-full bg-zinc-100">
              <img 
                alt={selectedRecipe.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                src={selectedRecipe.image_url || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80'}
              />
              <button 
                onClick={() => setSelectedRecipe(null)}
                className="absolute top-3 right-3 bg-white/80 hover:bg-white text-zinc-900 p-1.5 rounded-full shadow-xs transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <button 
                onClick={() => toggleFavorite(selectedRecipe.name)}
                className="absolute top-3 right-12 bg-white/80 hover:bg-white text-zinc-900 p-1.5 rounded-full shadow-xs transition-colors z-10"
                title={favorites.includes(selectedRecipe.name) ? "Bỏ yêu thích" : "Yêu thích món này"}
              >
                <Heart className={`w-5 h-5 ${favorites.includes(selectedRecipe.name) ? 'fill-red-500 text-red-500 border-none' : 'text-zinc-800'}`} />
              </button>
              <div className="absolute bottom-4 left-4 bg-emerald-600/90 text-white px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-extrabold backdrop-blur-sm">
                {renderCategoryIcon(selectedRecipe.category)} {selectedRecipe.category}
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed flex-grow">
              <div>
                <h3 className="font-extrabold text-lg text-zinc-900">{selectedRecipe.name}</h3>
                <p className="text-[11px] text-zinc-400 italic mt-1 leading-relaxed">"{selectedRecipe.description || 'Bữa ăn thơm nồng, dạt dào sức ấm gia đình.'}"</p>
                
                <div className="flex gap-4 text-[10px] font-bold text-zinc-500 mt-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-emerald-600" /> Thời gian: {selectedRecipe.cooking_time_min} Phút</span>
                  <span>•</span>
                  <span>Cần có: {(selectedRecipe.ingredientsNeeded || []).length} nguyên liệu</span>
                </div>
              </div>

              {/* Ingredients List */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-zinc-800 text-[10px] uppercase tracking-widest flex items-center justify-between">
                  <span>Thành phần nguyên liệu</span>
                  {selectedRecipe.missingIngredients && selectedRecipe.missingIngredients.length > 0 && (
                    <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                      thiếu {(selectedRecipe.missingIngredients || []).length} thực phẩm
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                  {(selectedRecipe.ingredientsNeeded || []).map((ig, idx) => {
                    const isMissing = selectedRecipe.missingIngredients?.some(m => m.toLowerCase() === ig.toLowerCase() || ig.toLowerCase().includes(m.toLowerCase()));
                    return (
                      <div key={idx} className="flex items-center gap-1.5 py-0.5">
                        {isMissing ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        )}
                        <span className={isMissing ? "text-amber-700 font-extrabold" : "text-zinc-700 font-medium"}>
                          {translateIngredientName(ig)} {isMissing && <span className="text-[9px] text-red-500 font-normal">(Thiếu)</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {selectedRecipe.missingIngredients && selectedRecipe.missingIngredients.length > 0 && (
                  <div className="pt-1">
                    {justAddedShopping.some(r => selectedRecipe.missingIngredients?.includes(r)) ? (
                      <div className="w-full bg-emerald-50 text-emerald-700 rounded-2xl py-3 px-4 text-xs font-bold border border-emerald-200 flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-700" /> Đã thêm tất cả đồ thiếu vào giỏ!
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddMissing(selectedRecipe.missingIngredients || [])}
                        className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 rounded-2xl py-3 px-4 text-xs font-black flex items-center justify-center gap-1.5 border border-emerald-100 transition-all active:scale-98 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4 text-emerald-600" /> Thêm {(selectedRecipe.missingIngredients || []).length} món thiếu vào danh sách chợ
                      </button>
                    )}
                  </div>
                )}

                {/* AI Substitutes Suggestion Panel */}
                {selectedRecipe.missingIngredients && selectedRecipe.missingIngredients.length > 0 && (
                  <div className="mt-3 border-t border-zinc-100 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[10px] text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Gợi ý thay thế thông minh AI
                      </span>
                    </div>

                    {!substitutes[selectedRecipe.name] ? (
                      <div>
                        {substituteError ? (
                          <div className="text-[11px] text-red-500 font-semibold bg-red-50 border border-red-100 rounded-xl p-2.5 flex items-center justify-between">
                            <span>{substituteError}</span>
                            <button 
                              onClick={() => handleFetchSubstitutes(selectedRecipe.name, selectedRecipe.missingIngredients || [])}
                              className="text-[10px] text-red-700 font-bold underline ml-1 cursor-pointer"
                            >
                              Thử lại
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleFetchSubstitutes(selectedRecipe.name, selectedRecipe.missingIngredients || [])}
                            disabled={isLoadingSubstitutes}
                            className="w-full bg-gradient-to-r from-teal-50 to-emerald-50 hover:from-teal-100 hover:to-emerald-100 text-teal-800 rounded-2xl py-3 px-4 text-xs font-black flex items-center justify-center gap-1.5 border border-teal-200 transition-all active:scale-98 cursor-pointer disabled:opacity-70"
                          >
                            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                            {isLoadingSubstitutes ? 'Đang hỏi đầu bếp Gemini AI...' : 'Gợi Ý Thay Thế Bằng AI'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/70 p-4 rounded-2xl border border-emerald-100 space-y-3">
                        {substitutes[selectedRecipe.name].map((item: any, idX: number) => (
                          <div key={idX} className="space-y-1.5 pb-2.5 last:pb-0 last:border-b-0 border-b border-emerald-100/60 break-words">
                            <div className="font-black text-zinc-800 text-[11px] flex items-center gap-1">
                              <span className="text-red-500 font-bold">✕</span> {translateIngredientName(item.missingIngredient)} thay bằng:
                            </div>
                            <div className="space-y-1.5 pl-3">
                              {item.substitutes?.map((sub: any, sIdx: number) => (
                                <div key={sIdx} className="bg-white/80 border border-emerald-200/50 rounded-xl p-2 flex flex-col gap-1 shadow-3xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[11px] text-emerald-900">{sub.name}</span>
                                    {sub.isInFridge && (
                                      <span className="bg-emerald-600 text-white text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider scale-90">Có sẵn trong tủ ✅</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-zinc-500 leading-normal">{sub.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="text-[9px] text-emerald-700/80 italic text-center pt-1 font-medium">
                          * Đầu bếp Gemini AI đã tối ưu dinh dưỡng dựa trên tủ lạnh!
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Driving Instructions */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-zinc-800 text-[10px] uppercase tracking-widest flex items-center gap-1">
                  <BookOpen className="w-4 h-4 text-emerald-600" /> Hướng dẫn đun nấu
                </h4>
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 text-xs text-zinc-600 leading-relaxed space-y-1.5">
                  {(selectedRecipe.instructions || '').split('\n').map((step, idx) => (
                    <p key={idx} className="last:mb-0">{step}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-100 bg-white flex flex-col gap-2">
              {cookingSuccess ? (
                <div className="w-full bg-emerald-500 text-white py-3.5 rounded-full font-bold text-xs text-center shadow-md flex items-center justify-center gap-1.5 animate-pulse">
                  <Check className="w-4 h-4 text-white" /> Đang dọn bếp... Món ăn sẵn sàng!
                </div>
              ) : (
                <button 
                  onClick={() => handleStartCooking(selectedRecipe)}
                  disabled={cookingActive}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-full font-bold text-xs text-center shadow-md shadow-emerald-200 transition-all active:scale-95 cursor-pointer disabled:bg-zinc-400 flex items-center justify-center gap-1.5"
                >
                  {cookingActive ? 'Đang hạ tải nguyên liệu...' : 'Mở Bếp & Bắt Đầu Nấu Ngay!'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DELETE SINGLE COOKED ITEM MODAL */}
      {deleteCookedId !== null && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden border border-zinc-100 flex flex-col p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 stroke-[2.3]" />
              </div>
              <h3 className="font-extrabold text-base text-zinc-900 leading-tight">Xác nhận xoá món ăn</h3>
            </div>
            
            <p className="text-xs text-zinc-500 leading-relaxed">
              Bạn có chắc chắn muốn xoá món <strong className="text-zinc-800 font-extrabold">"{deleteRecipeName}"</strong> khỏi danh sách lịch sử đã nấu không? Thao tác này không thể hoàn tác.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setDeleteCookedId(null);
                  setDeleteRecipeName('');
                }}
                disabled={isDeleting}
                className="flex-1 py-3 text-zinc-500 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 rounded-full font-bold text-xs text-center cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeDeleteCooked}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-xs text-center cursor-pointer transition-all active:scale-95 shadow-md shadow-red-200/50 disabled:bg-red-400 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? 'Đang xoá...' : 'Xóa lịch sử'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM CLEAR ALL COOKED HISTORY MODAL */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden border border-zinc-100 flex flex-col p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 stroke-[2.3]" />
              </div>
              <h3 className="font-extrabold text-base text-zinc-900 leading-tight font-sans">Xoá toàn bộ lịch sử</h3>
            </div>
            
            <p className="text-xs text-zinc-500 leading-relaxed">
              Bạn có thực sự chắc chắn muốn <span className="font-bold text-red-600">xoá SẠCH TOÀN BỘ</span> lịch sử nấu ăn từ trước tới nay? Dữ liệu về số lần đun nấu sẽ bị xóa dữ liệu hoàn toàn.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 text-zinc-500 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 rounded-full font-bold text-xs text-center cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                Quay lại
              </button>
              <button
                onClick={executeClearAllCooked}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-xs text-center cursor-pointer transition-all active:scale-95 shadow-md shadow-red-200/50 disabled:bg-red-400 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? 'Đang xoá...' : 'Xóa sạch hết'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
