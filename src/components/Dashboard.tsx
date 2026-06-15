import { useState, useEffect, FormEvent, useRef } from 'react';
import { 
  Bell, Plus, Trash2, Camera, Mic, Info, Sparkles, X, Egg, ChevronRight, Check, Loader2, Upload, Volume2, AlertTriangle, Lightbulb, RefreshCw
} from 'lucide-react';
import { ExpiryAlert, FridgeStatus, Ingredient } from '../types';
import { translateIngredientName } from '../utils/translation';

interface DashboardProps {
  status: FridgeStatus;
  alerts: ExpiryAlert[];
  ingredients: Ingredient[];
  onRefresh: () => void;
  onAddIngredient: (item: { name: string; category: any; quantity: string; expiry_date: string }) => Promise<void>;
  onRemoveIngredient: (id: number) => Promise<void>;
}

export default function Dashboard({
  status,
  alerts,
  ingredients,
  onRefresh,
  onAddIngredient,
  onRemoveIngredient
}: DashboardProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  
  // Kitchen Tip State & Trigger
  const [kitchenTip, setKitchenTip] = useState<{ title: string; category: string; tip: string } | null>(null);
  const [loadingTip, setLoadingTip] = useState(false);

  const fetchKitchenTip = async () => {
    try {
      setLoadingTip(true);
      const res = await fetch('/api/kitchen-tip');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setKitchenTip({
            title: data.title,
            category: data.category,
            tip: data.tip
          });
        }
      }
    } catch (err) {
      console.error("Lỗi tải mẹo nhà bếp:", err);
    } finally {
      setLoadingTip(false);
    }
  };

  useEffect(() => {
    fetchKitchenTip();
  }, []);
  
  // Quick Add Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Meats' | 'Veggies' | 'Condiments' | 'Dry Food' | 'Dairy' | 'Produce'>('Veggies');
  const [quantity, setQuantity] = useState('');
  const [expiryDays, setExpiryDays] = useState(3);
  const [errorMsg, setErrorMsg] = useState('');

  // Real device hardware integrations
  const [scanTab, setScanTab] = useState<'camera' | 'upload'>('camera');
  const [scanStream, setScanStream] = useState<MediaStream | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedItems, setScannedItems] = useState<Array<{ name: string; category: 'Meats' | 'Veggies' | 'Condiments' | 'Dry Food' | 'Dairy' | 'Produce'; quantity: string; expiryDays: number }>>([]);
  const [scannedUploadedImage, setScannedUploadedImage] = useState<string | null>(null);
  const [scanError, setScanError] = useState('');
  
  // Real voice speech states
  const [voiceInputType, setVoiceInputType] = useState<'mic' | 'text'>('mic');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResponseText, setVoiceResponseText] = useState('');
  const [voiceActions, setVoiceActions] = useState<any[]>([]);
  const [voiceSuccessMessage, setVoiceSuccessMessage] = useState('');
  const [voiceError, setVoiceError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Check SpeechRecognition support (covers Web Speech API in Chrome & Safari)
  const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSpeechSupported = !!SpeechRecognitionAPI;

  // Camera Management
  const startCamera = async () => {
    try {
      setScanError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      setScanStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.error("Video element failed to play audio/video stream:", err));
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setScanError('Không kết nối được Camera thiết bị. Vui lòng cấp quyền camera trong trình duyệt hoặc chuyển sang tab "Tải ảnh hóa đơn"!');
    }
  };

  const stopCamera = () => {
    if (scanStream) {
      scanStream.getTracks().forEach(track => track.stop());
      setScanStream(null);
    }
  };

  // Keep camera state synced dynamically with tab toggle or modal visibility
  useEffect(() => {
    if (showScanModal) {
      if (scanTab === 'camera') {
        startCamera();
      } else {
        stopCamera();
      }
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showScanModal, scanTab]);

  // Clean speech listeners on unmount
  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    };
  }, []);

  // Capture current camera video feed to base64
  const captureSnapshot = async () => {
    if (!videoRef.current) return;
    try {
      setScanLoading(true);
      setScanError('');
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        setScannedUploadedImage(base64);
        stopCamera();
        await processReceiptImage(base64);
      }
    } catch (err: any) {
      setScanError('Lỗi khi thu hình: ' + err.message);
      setScanLoading(false);
    }
  };

  // Convert uploaded image file to base64
  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanLoading(true);
    setScanError('');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setScannedUploadedImage(base64);
      await processReceiptImage(base64);
    };
    reader.onerror = () => {
      setScanError('Không thể nạp file ảnh này. Vui lòng chọn ảnh định dạng JPG/PNG.');
      setScanLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Send receipt image to backend for real Gemini Vision OCR processing
  const processReceiptImage = async (base64Image: string) => {
    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.items) {
          setScannedItems(data.items);
        } else {
          setScanError('Ủy quyền Gemini phân tích thất bại. Vui lòng thử lại!');
        }
      } else {
        setScanError('Lỗi phản hồi máy chủ (' + response.status + ').');
      }
    } catch (err: any) {
      setScanError('Không kết nối được dịch vụ: ' + err.message);
    } finally {
      setScanLoading(false);
    }
  };

  // Save parsed products from the scan results
  const saveAllScannedItems = async () => {
    try {
      setScanLoading(true);
      for (const item of scannedItems) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + item.expiryDays);
        await onAddIngredient({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          expiry_date: targetDate.toISOString().split('T')[0]
        });
      }
      onRefresh();
      setShowScanModal(false);
      setScannedItems([]);
      setScannedUploadedImage(null);
    } catch (err: any) {
      setScanError('Lưu nguyên liệu lỗi: ' + err.message);
    } finally {
      setScanLoading(false);
    }
  };

  // Speak voice listener controllers
  const toggleSpeechRecognition = () => {
    if (voiceListening) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setVoiceListening(false);
    } else {
      if (!isSpeechSupported) return;
      setVoiceError('');
      setVoiceSuccessMessage('');
      setVoiceResponseText('');
      setVoiceActions([]);
      
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'vi-VN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceListening(true);
      };

      recognition.onresult = (e: any) => {
        const resultText = e.results[0][0].transcript;
        setVoiceText(resultText);
      };

      recognition.onerror = (e: any) => {
        console.error("Speech Recognition Err:", e);
        if (e.error === 'not-allowed') {
          setVoiceError('Trình lặp chưa được cho phép truy cập Microphone. Vui lòng cấp quyền trong cài đặt trình duyệt!');
        } else {
          setVoiceError('Lỗi ghi âm giọng nói: ' + e.error);
        }
        setVoiceListening(false);
      };

      recognition.onend = () => {
        setVoiceListening(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    }
  };

  // Parse voice text with Gemini backend command interpreter
  const submitVoiceCommand = async (textToSubmit = voiceText) => {
    if (!textToSubmit.trim()) return;
    try {
      setVoiceLoading(true);
      setVoiceError('');
      setVoiceSuccessMessage('');
      
      const response = await fetch('/api/parse-voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: textToSubmit })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVoiceResponseText(data.textResponse);
          setVoiceActions(data.actions || []);
          
          let countAdd = 0;
          let countRemove = 0;
          
          for (const rawAct of (data.actions || [])) {
            if (rawAct.type === 'ADD') {
              const d = new Date();
              d.setDate(d.getDate() + (rawAct.expiryDays || 3));
              await onAddIngredient({
                name: rawAct.name,
                category: rawAct.category || 'Veggies',
                quantity: rawAct.quantity || '1 bọc',
                expiry_date: d.toISOString().split('T')[0]
              });
              countAdd++;
            } else if (rawAct.type === 'REMOVE') {
              if (rawAct.targetId) {
                await onRemoveIngredient(rawAct.targetId);
                countRemove++;
              } else {
                const term = rawAct.name.toLowerCase();
                const matchedVal = ingredients.find(i => 
                  i.name.toLowerCase().includes(term) || term.includes(i.name.toLowerCase())
                );
                if (matchedVal) {
                  await onRemoveIngredient(matchedVal.id);
                  countRemove++;
                }
              }
            }
          }
          
          onRefresh();
          setVoiceSuccessMessage(`Thực thi thành công: Đã thêm ${countAdd} & Dọn ${countRemove} nguyên liệu.`);
          setVoiceText('');
        } else {
          setVoiceError('Không giải nghĩa được hành động từ giọng nói này.');
        }
      } else {
        setVoiceError('Lỗi giao lưu máy chủ nhận dạng.');
      }
    } catch (err: any) {
      setVoiceError('Sự cố: ' + err.message);
    } finally {
      setVoiceLoading(false);
    }
  };

  // Slices for Donut (Circumference of r=40 is ~251.2)
  const totalCircumference = 251.2;
  const meatsOffset = 0;
  const meatsLength = (status.breakdown.meats / 100) * totalCircumference;
  
  const veggiesOffset = meatsLength;
  const veggiesLength = (status.breakdown.veggies / 100) * totalCircumference;
  
  const condimentsOffset = meatsLength + veggiesLength;
  const condimentsLength = (status.breakdown.condiments / 100) * totalCircumference;
  
  const dryFoodOffset = meatsLength + veggiesLength + condimentsLength;
  const dryFoodLength = (status.breakdown.dryFood / 100) * totalCircumference;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !quantity.trim()) {
      setErrorMsg('Vui lòng điền đầy đủ tên và số lượng!');
      return;
    }
    setErrorMsg('');
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + expiryDays);
    const expiryStr = targetDate.toISOString().split('T')[0];

    await onAddIngredient({
      name: name.trim(),
      category,
      quantity: quantity.trim(),
      expiry_date: expiryStr
    });

    // Reset values
    setName('');
    setQuantity('');
    setExpiryDays(3);
    setShowAddModal(false);
  };

  // Preset Receipts for Camera Scanning Simulation
  const presetReceipts = [
    {
      title: "Hóa đơn Siêu thị Co.opmart (Premium Meats & Produce)",
      items: [
        { name: "Phile Cá Hồi Na Uy (Salmon)", category: "Meats", quantity: "300g", expiryDays: 2 },
        { name: "Măng Tây Tươi (Asparagus)", category: "Produce", quantity: "500g", expiryDays: 3 },
        { name: "Phô Mai Mozzarella", category: "Dairy", quantity: "200g", expiryDays: 14 }
      ]
    },
    {
      title: "Hóa đơn Đi Chợ Sáng (Traditional Fresh Items)",
      items: [
        { name: "Thịt Ba Rọi Heo", category: "Meats", quantity: "600g", expiryDays: 4 },
        { name: "Cà Rốt Đà Lạt", category: "Produce", quantity: "3 củ", expiryDays: 10 },
        { name: "Nấm Đông Cô Tươi", category: "Produce", quantity: "150g", expiryDays: 3 }
      ]
    }
  ];

  const handleScanReceipt = async (items: typeof presetReceipts[0]['items']) => {
    for (const it of items) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + it.expiryDays);
      await onAddIngredient({
        name: it.name,
        category: it.category as any,
        quantity: it.quantity,
        expiry_date: targetDate.toISOString().split('T')[0]
      });
    }
    setShowScanModal(false);
  };

  // Preset Voice commands
  const voiceCommands = [
    {
      speech: "Thêm 10 quả Trứng Gà Ta và 1 bọc Rau Muống tươi",
      actionDesc: "Thêm trứng gà (hết hạn trong 5 ngày) và rau muống (hết hạn trong 2 ngày)",
      execute: async () => {
        const d1 = new Date(); d1.setDate(d1.getDate() + 5);
        const d2 = new Date(); d2.setDate(d2.getDate() + 2);
        await onAddIngredient({ name: "Trứng Gà Ta", category: "Dairy", quantity: "10 quả", expiry_date: d1.toISOString().split('T')[0] });
        await onAddIngredient({ name: "Rau Muống Sạch", category: "Produce", quantity: "1 bọc", expiry_date: d2.toISOString().split('T')[0] });
      }
    },
    {
      speech: "Hết Sữa Tươi rồi, hãy xóa Sữa Tươi khỏi tủ lạnh",
      actionDesc: "Tìm và dọn hết các hộp sữa đã hết hạn hoặc đã dùng xong khỏi kho",
      execute: async () => {
        const milks = ingredients.filter(i => i.name.toLowerCase().includes('milk') || i.name.toLowerCase().includes('sữa'));
        for (const m of milks) {
          await onRemoveIngredient(m.id);
        }
      }
    }
  ];

  return (
    <div className="flex flex-col gap-md animate-fade-in" id="dashboard-view">
      {/* Welcome Section */}
      <section className="flex flex-col gap-xs">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">Chào buổi sáng, Chef!</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Dưới đây là tổng quan quản lý thực phẩm hôm nay.</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 bg-primary hover:bg-primary-container text-white flex items-center justify-center rounded-full shadow-md transition-transform hover:scale-105 active:scale-95"
            title="Thêm nguyên liệu"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* AI Kitchen Tip Card */}
      {kitchenTip && (
        <section className="bg-gradient-to-br from-emerald-50/60 to-emerald-100/30 border border-emerald-100/80 rounded-3xl p-5 shadow-xs flex flex-col gap-3 relative overflow-hidden group transition-all hover:shadow-xs hover:border-emerald-200">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-200/20 rounded-full blur-xl pointer-events-none group-hover:scale-110 transition-transform"></div>
          
          <div className="flex justify-between items-center z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-600 rounded-xl text-white flex items-center justify-center shadow-sm">
                <Lightbulb className="w-3.5 h-3.5 text-white" />
              </span>
              <div>
                <span className="text-[10px] font-black tracking-widest text-emerald-800 uppercase block leading-none">
                  Mẹo nhà bếp từ AI
                </span>
                <span className="text-[9px] font-semibold text-emerald-600/70 block mt-0.5">
                  {kitchenTip.category || "Bí quyết hay"}
                </span>
              </div>
            </div>
            
            <button
              onClick={fetchKitchenTip}
              disabled={loadingTip}
              className="p-2 text-emerald-800 hover:text-emerald-900 bg-white/80 hover:bg-white rounded-xl border border-emerald-100/80 transition-all shadow-3xs active:scale-90 disabled:opacity-60 flex items-center justify-center cursor-pointer"
              title="Xem mẹo khác"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTip ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5 z-10">
            <h4 className="font-extrabold text-sm text-emerald-950 font-sans tracking-tight">
              {kitchenTip.title}
            </h4>
            <p className="text-zinc-600 text-xs leading-relaxed font-semibold">
              {kitchenTip.tip}
            </p>
          </div>
        </section>
      )}

      {/* Quick Stats: Donut Chart */}
      <section className="bg-white rounded-3xl p-6 shadow-xs border border-zinc-200 flex flex-col items-center gap-6">
        <div className="flex justify-between items-center w-full">
          <h3 className="font-bold text-zinc-900 text-sm tracking-widest uppercase">Trạng Thái Tủ Lạnh</h3>
          <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
            {ingredients.length} nguyên liệu
          </span>
        </div>

        <div className="relative w-48 h-48">
          {/* SVG Donut Chart */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle cx="50" cy="50" fill="transparent" r="40" stroke="#f4f4f5" strokeWidth="11" />
            
            {status.percentage > 0 ? (
              <>
                {/* Meats (Amber) */}
                {status.breakdown.meats > 0 && (
                  <circle
                    className="donut-segment transition-all duration-1000"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="#f59e0b"
                    strokeWidth="11"
                    strokeDasharray={`${meatsLength} ${totalCircumference}`}
                    strokeDashoffset={-meatsOffset}
                  />
                )}

                {/* Veggies (Emerald Green) */}
                {status.breakdown.veggies > 0 && (
                  <circle
                    className="donut-segment transition-all duration-1000"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="#059669"
                    strokeWidth="11"
                    strokeDasharray={`${veggiesLength} ${totalCircumference}`}
                    strokeDashoffset={-veggiesOffset}
                  />
                )}

                {/* Condiments (Cyan/Teal) */}
                {status.breakdown.condiments > 0 && (
                  <circle
                    className="donut-segment transition-all duration-1000"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="#06b6d4"
                    strokeWidth="11"
                    strokeDasharray={`${condimentsLength} ${totalCircumference}`}
                    strokeDashoffset={-condimentsOffset}
                  />
                )}

                {/* Dry Food (Slate Gray) */}
                {status.breakdown.dryFood > 0 && (
                  <circle
                    className="donut-segment transition-all duration-1000"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="#71717a"
                    strokeWidth="11"
                    strokeDasharray={`${dryFoodLength} ${totalCircumference}`}
                    strokeDashoffset={-dryFoodOffset}
                  />
                )}
              </>
            ) : null}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold tracking-tight text-zinc-900">{status.percentage}%</span>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Sức Chứa</span>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full py-3 border-t border-zinc-100 text-[11px] font-semibold text-zinc-600">
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Thịt & Cá ({status.breakdown.meats}%)</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <span>Rau củ quả ({status.breakdown.veggies}%)</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
            <span>Gia vị / Đậu ({status.breakdown.condiments}%)</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-500"></span>
            <span>Đồ khô / Gạo ({status.breakdown.dryFood}%)</span>
          </div>
        </div>
      </section>

      {/* Expiry Alerts Section */}
      <section className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-zinc-900 text-sm tracking-widest uppercase">Cảnh Báo Hạn Sử Dụng</h3>
          <span className="text-xs text-emerald-800 font-extrabold flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-100">
            <Sparkles className="w-3.5 h-3.5" /> Tự động theo dõi
          </span>
        </div>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-6 bg-zinc-50 rounded-2xl border border-zinc-200 text-zinc-500 text-xs">
              Tủ lạnh hoàn hảo! Không có nguyên liệu nào sắp hết hạn.
            </div>
          ) : (
            alerts.map((item) => {
              let tagBg = "bg-emerald-50 text-emerald-700 border border-emerald-100";
              let dotColor = "bg-emerald-500";
              if (item.daysRemaining <= 1) {
                tagBg = "bg-red-50 text-red-700 border border-red-100";
                dotColor = "bg-red-500";
              } else if (item.daysRemaining <= 3) {
                tagBg = "bg-amber-50 text-amber-700 border border-amber-100";
                dotColor = "bg-amber-500";
              }

              return (
                <div 
                  key={item.id} 
                  className="bg-zinc-50/50 rounded-2xl p-3 border border-zinc-200/80 flex justify-between items-center group transition-colors hover:bg-zinc-100/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-10 rounded-full ${dotColor}`}></div>
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900 text-sm">{translateIngredientName(item.name)}</span>
                      <span className="text-[11px] font-semibold text-zinc-400 mt-0.5">{item.category} • {item.quantity}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full ${tagBg}`}>
                      {item.alertText}
                    </span>
                    <button
                      onClick={() => onRemoveIngredient(item.id)}
                      className="p-1.5 hover:bg-red-50 hover:border-red-100 border border-transparent text-red-600 rounded-lg transition-all active:scale-95"
                      title="Xóa nguyên liệu này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Floating simulator utilities for tactile feel */}
      <div className="bg-zinc-900 text-white rounded-3xl p-5 border border-zinc-800 shadow-xl flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black tracking-widest text-emerald-400 font-mono uppercase">TRUNG TÂM GIẢ LẬP GIAO DIỆN AI</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setShowScanModal(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-2xl py-3 text-xs font-bold transition-all active:scale-95 text-zinc-100 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Quét Hóa Đơn</span>
          </button>
          
          <button 
            onClick={() => setShowVoiceModal(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 rounded-2xl py-3 text-xs font-bold transition-all active:scale-95 text-white shadow-md shadow-emerald-950/40 cursor-pointer"
          >
            <Mic className="w-4 h-4 text-white animate-pulse" />
            <span>Lệnh Giọng Nói</span>
          </button>
        </div>

        <div className="bg-zinc-950 rounded-xl p-3 font-mono text-[9px] text-emerald-400/90 leading-relaxed border border-zinc-800/80">
          <p>[HỆ THỐNG] Phòng bếp SQLite: ĐÃ KẾT NỐI THÀNH CÔNG</p>
          <p>[GEMINI] Trợ lý đa phương thức: SẴN SÀNG (gemini-3.5-flash)</p>
          <p>[HƯỚNG DẪN] Nhấp Quét Hóa Đơn hoặc Lệnh Giọng Nói để trải nghiệm rảnh tay!</p>
        </div>
      </div>

      {/* MODAL 1: ADD INGREDIENT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="bg-primary text-white p-4 flex justify-between items-center">
              <h4 className="font-bold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> Thêm Nguyên Liệu Mới
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-sm text-sm">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface text-xs uppercase tracking-wide">Tên Nguyên Liệu</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Cá Hồi Na Uy, Trứng gà ta..."
                  className="border border-surface-variant rounded-lg p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface text-xs uppercase tracking-wide">Phân Loại</label>
                <select 
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="border border-surface-variant rounded-lg p-2 focus:ring-1 focus:ring-primary focus:outline-none bg-white font-medium"
                >
                  <option value="Meats">Thịt / Cá (Meats)</option>
                  <option value="Veggies">Rau củ quả (Veggies)</option>
                  <option value="Condiments">Gia vị / Đậu hũ (Condiments)</option>
                  <option value="Dry Food">Đồ khô / Gạo (Dry Food)</option>
                  <option value="Dairy">Sữa / Trứng (Dairy)</option>
                  <option value="Produce">Rau dập sẵn (Produce)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface text-xs uppercase tracking-wide">Số Lượng</label>
                  <input 
                    type="text" 
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Ví dụ: 400g, 1 vỉ..."
                    className="border border-surface-variant rounded-lg p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface text-xs uppercase tracking-wide">Hạn Dùng (Số Ngày)</label>
                  <input 
                    type="number" 
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(parseInt(e.target.value) || 1)}
                    min="1"
                    className="border border-surface-variant rounded-lg p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              {errorMsg && <p className="text-red-600 font-semibold text-xs mt-1">{errorMsg}</p>}

              <button 
                type="submit" 
                className="w-full bg-secondary hover:bg-secondary-container text-white py-3 rounded-full font-bold shadow transition-colors mt-2"
              >
                Xác Nhận Thêm Vào Tủ Lạnh
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIPT CAMERA SCANNER */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-zinc-100 flex flex-col max-h-[85vh]">
            <div className="bg-primary text-white p-5 flex justify-between items-center shrink-0">
              <h4 className="font-bold text-base flex items-center gap-2">
                <Camera className="w-5 h-5 animate-pulse" /> Trợ Lý Thấu Kính AI (Scan Camera)
              </h4>
              <button 
                onClick={() => {
                  stopCamera();
                  setShowScanModal(false);
                }} 
                className="text-white/80 hover:text-white transition-opacity cursor-pointer p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex shrink-0 border-b border-zinc-100 text-xs font-bold text-zinc-500 font-mono">
              <button
                onClick={() => setScanTab('camera')}
                className={`flex-1 py-3 text-center transition-all border-b-2 cursor-pointer ${scanTab === 'camera' ? 'border-primary text-primary bg-zinc-50/50' : 'border-transparent hover:text-zinc-700'}`}
              >
                MÁY ẢNH TRỰC TIẾP
              </button>
              <button
                onClick={() => setScanTab('upload')}
                className={`flex-1 py-3 text-center transition-all border-b-2 cursor-pointer ${scanTab === 'upload' ? 'border-primary text-primary bg-zinc-50/50' : 'border-transparent hover:text-zinc-700'}`}
              >
                TẢI ẢNH HÓA ĐƠN
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto w-full text-zinc-700 text-xs leading-relaxed">
              {scanError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-2xl border border-red-100 flex gap-2 items-start font-semibold text-[11px]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* Scanned Items list review stage */}
              {scannedItems.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-2xl p-3 text-[11px] font-semibold">
                    🎉 <span className="font-bold">Nhận diện hoàn tất!</span> Dưới đây là các nguyên liệu Gemini AI trích xuất từ hóa đơn của bạn. Vui lòng kiểm tra lại trước khi phê duyệt:
                  </div>

                  <div className="space-y-2 border border-zinc-100 rounded-2xl p-3 bg-zinc-50/50">
                    {scannedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-2 py-1.5 border-b border-zinc-200/50 last:border-none text-[11px]">
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const updated = [...scannedItems];
                              updated[idx].name = e.target.value;
                              setScannedItems(updated);
                            }}
                            className="font-bold text-zinc-900 bg-transparent border-b border-transparent focus:border-zinc-400 focus:outline-none"
                          />
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">{item.category} • {item.quantity}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.expiryDays}
                            min="1"
                            title="Hạn bảo quản (ngày)"
                            onChange={(e) => {
                              const updated = [...scannedItems];
                              updated[idx].expiryDays = parseInt(e.target.value) || 3;
                              setScannedItems(updated);
                            }}
                            className="w-12 text-center border border-zinc-200 bg-white rounded-lg p-1 font-bold font-mono focus:outline-none"
                          />
                          <span className="text-[10px] text-zinc-400 font-semibold">ngày</span>
                          <button
                            onClick={() => {
                              setScannedItems(scannedItems.filter((_, i) => i !== idx));
                            }}
                            className="p-1 hover:bg-red-50 text-red-500 rounded-lg ml-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1 shrink-0">
                    <button
                      onClick={() => {
                        setScannedItems([]);
                        setScannedUploadedImage(null);
                        if (scanTab === 'camera') startCamera();
                      }}
                      className="border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 py-2.5 rounded-2xl font-bold transition-all active:scale-95"
                    >
                      Quét Lại Ảnh Khác
                    </button>
                    <button
                      onClick={saveAllScannedItems}
                      disabled={scanLoading}
                      className="bg-primary hover:bg-primary-container text-white py-2.5 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {scanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Nhập vào tủ lạnh</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Camera snapshot view */}
                  {scanTab === 'camera' && (
                    <div className="flex flex-col gap-4">
                      <p className="text-zinc-500 text-[11px] leading-relaxed">
                        Đưa hóa đơn của bạn đối diện thấu kính máy ảnh, giữ cố định và nút chụp để Gemini trích xuất dữ liệu tự động.
                      </p>

                      <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-200 flex items-center justify-center group shadow-inner">
                        {scanLoading ? (
                          <div className="absolute inset-0 bg-black/60 z-10 flex flex-col items-center justify-center gap-3 text-white px-8 text-center animate-fade-in">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                            <span className="font-semibold text-xs text-zinc-300">Gemini Vision AI tủ lạnh xanh đang đọc chữ viết hóa đơn, phân tách nhóm dưỡng chất tự động...</span>
                          </div>
                        ) : null}

                        {scanStream ? (
                          <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-zinc-500 text-[11px] flex flex-col items-center gap-2">
                            <span className="p-3 bg-zinc-100 rounded-full text-zinc-400"><Camera className="w-6 h-6" /></span>
                            <span>Đang chặn thấu kính camera thiết bị</span>
                            <button
                              onClick={startCamera}
                              className="px-4 py-2 bg-zinc-800 text-zinc-100 rounded-xl font-bold text-xs mt-2 hover:bg-zinc-700 transition"
                            >
                              Khởi Động Thấu Kính
                            </button>
                          </div>
                        )}

                        <div className="absolute top-3 left-3 bg-zinc-900/80 text-[9px] text-emerald-400 font-mono font-bold px-2 py-0.5 rounded-full border border-zinc-700/50 uppercase tracking-widest pointer-events-none">
                          CAM VIEWPORT
                        </div>

                        {scanStream && !scanLoading && (
                          <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
                            <button
                              onClick={captureSnapshot}
                              className="pointer-events-auto w-12 h-12 bg-white rounded-full border-4 border-zinc-200 flex items-center justify-center hover:scale-110 cursor-pointer active:scale-95 transition shadow-lg shrink-0"
                              title="Chụp ảnh quét hóa đơn"
                            >
                              <span className="w-7 h-7 bg-red-500 rounded-full shrink-0"></span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Upload selection */}
                  {scanTab === 'upload' && (
                    <div className="flex flex-col gap-4">
                      <p className="text-zinc-500 text-[11px] leading-relaxed">
                        Bạn chưa mở camera? Hãy chọn hoặc tải trực tiếp một file ảnh chụp hóa đơn mua hàng từ thư viện máy.
                      </p>

                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-primary/50 bg-zinc-50 rounded-2xl p-8 cursor-pointer transition-colors relative group">
                        {scanLoading ? (
                          <div className="absolute inset-0 bg-white/90 rounded-2xl flex flex-col items-center justify-center gap-2 text-center px-4 animate-fade-in z-20">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                            <span className="font-bold text-xs text-zinc-700">Gemini OCR đang tự động tách nhóm sản phẩm...</span>
                          </div>
                        ) : null}

                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleFileUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                          disabled={scanLoading}
                        />
                        <Upload className="w-8 h-8 text-zinc-400 group-hover:text-primary transition-colors mb-2" />
                        <span className="font-bold text-xs text-zinc-700">Chọn ảnh hóa đơn của bạn</span>
                        <span className="text-[10px] text-zinc-400 font-semibold mt-1">Định dạng PNG, JPG (Dung lượng &lt; 5MB)</span>
                      </div>
                    </div>
                  )}

                  {/* Sample Preset items simulation fallback */}
                  <div className="mt-4 pt-4 border-t border-zinc-100 shrink-0">
                    <span className="text-[10px] font-bold text-zinc-400 font-mono tracking-wider uppercase block mb-2">HÓA ĐƠN MẪU KHUYÊN TRẢI NGHIỆM:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {presetReceipts.map((rec, rIdx) => (
                        <button 
                          key={rIdx}
                          onClick={() => handleScanReceipt(rec.items)}
                          className="text-left p-2.5 border border-zinc-200 hover:border-zinc-300 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer text-[10px]"
                        >
                          <p className="font-bold text-zinc-800 line-clamp-1">{rec.title}</p>
                          <span className="text-zinc-400 font-semibold mt-0.5 block">{rec.items.length} món • Hỗ trợ nhanh</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VOICE COMMANDS SCREEN */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up border border-zinc-100 flex flex-col max-h-[85vh]">
            <div className="bg-[#4caf50] text-white p-5 flex justify-between items-center shrink-0">
              <h4 className="font-bold text-base flex items-center gap-2">
                <Mic className="w-5 h-5 text-white animate-pulse" /> Trợ Lý Giọng Nói Nấu Bếp
              </h4>
              <button 
                onClick={() => {
                  if (voiceListening && speechRecognitionRef.current) {
                    speechRecognitionRef.current.stop();
                  }
                  setShowVoiceModal(false);
                }} 
                className="text-white/80 hover:text-white transition-opacity cursor-pointer p-1 rounded-full hover:bg-white/10 shrink-0"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <div className="flex shrink-0 border-b border-zinc-100 text-xs font-bold text-zinc-500 font-mono">
              <button
                onClick={() => setVoiceInputType('mic')}
                className={`flex-1 py-3 text-center transition-all border-b-2 cursor-pointer ${voiceInputType === 'mic' ? 'border-green-500 text-green-700 bg-zinc-50/50' : 'border-transparent hover:text-zinc-700'}`}
              >
                NÓI TRỰC TIẾP (MIC)
              </button>
              <button
                onClick={() => setVoiceInputType('text')}
                className={`flex-1 py-3 text-center transition-all border-b-2 cursor-pointer ${voiceInputType === 'text' ? 'border-green-500 text-green-700 bg-zinc-50/50' : 'border-transparent hover:text-zinc-700'}`}
              >
                NHẬP LỆNH CHỮ
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto w-full text-zinc-750 text-xs justify-between max-h-[60vh]">
              {voiceError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-2xl border border-red-100 flex gap-2 items-start font-semibold text-[11px] shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{voiceError}</span>
                </div>
              )}

              {voiceSuccessMessage && (
                <div className="bg-emerald-50 text-emerald-800 p-3 rounded-2xl border border-emerald-100 flex gap-2 items-start font-semibold text-[11px] shrink-0">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{voiceSuccessMessage}</span>
                </div>
              )}

              {/* Display voice reply bubble by Assistant */}
              {voiceResponseText && (
                <div className="flex flex-col gap-1 bg-green-50/60 rounded-2xl p-4 border border-green-150 relative shrink-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider flex items-center gap-1.5 font-mono">
                      <Volume2 className="w-3.5 h-3.5 text-green-600 animate-bounce" /> PHẢN HỒI TỪ TRỢ LÝ
                    </span>
                    <span className="text-[9px] font-mono text-green-500 font-bold">GEMINI 3.5 FLASH</span>
                  </div>
                  <p className="mt-1.5 font-semibold text-zinc-800 leading-normal italic text-[11px]">
                    "{voiceResponseText}"
                  </p>
                  
                  {voiceActions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-green-200/50 space-y-1 text-[10px] text-green-800 font-semibold font-mono">
                      <span>Cơ sở dữ liệu vừa cập nhật:</span>
                      {voiceActions.map((act, aIdx) => (
                        <div key={aIdx} className="flex items-center gap-1.5 pl-2">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{act.type === 'ADD' ? 'THÊM' : 'LOẠI BỎ'}: {act.name} ({act.quantity || 'đầy đủ / dùng hết'})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-4 text-center items-center py-2 shrink-0">
                {voiceInputType === 'mic' ? (
                  <>
                    <p className="text-zinc-500 text-[11px] px-2 leading-relaxed">
                      {!isSpeechSupported 
                        ? 'Trình duyệt này lỗi không tích hợp thu giọng. Mời Chef gõ chữ ở tab bên cạnh nhé!'
                        : 'Bật Microphone và ra lệnh bằng Tiếng Việt (Ví dụ: "thêm ba hộp sữa tươi hạt điều và dọn sạch cải ngọt").'}
                    </p>

                    {isSpeechSupported && (
                      <div className="flex flex-col items-center gap-4 py-2 w-full">
                        <button
                          onClick={toggleSpeechRecognition}
                          disabled={voiceLoading}
                          className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer shadow-lg outline-none transition-all relative ${voiceListening ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-white hover:bg-opacity-90 active:scale-95'}`}
                        >
                          {voiceListening ? (
                            <>
                              <span className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-30"></span>
                              <Mic className="w-8 h-8" />
                            </>
                          ) : (
                            <Mic className="w-8 h-8" />
                          )}
                        </button>
                        
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                          {voiceListening ? 'ĐANG LẮNG NGHE CHÉF...' : 'NHẤP ĐỂ NÓI'}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full flex flex-col gap-2">
                    <p className="text-zinc-500 text-[11px] text-left">Gõ câu lệnh Tiếng Việt điều ước quản lý tủ lạnh:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={voiceText}
                        onChange={(e) => setVoiceText(e.target.value)}
                        placeholder='Ví dụ: "Hết sạch sườn heo rồi dọn khỏi tủ..."'
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitVoiceCommand();
                        }}
                        className="flex-1 border border-zinc-200 bg-zinc-50/50 rounded-xl p-2.5 text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <button
                        onClick={() => submitVoiceCommand()}
                        disabled={voiceLoading || !voiceText.trim()}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition text-[11px]"
                      >
                        Gửi
                      </button>
                    </div>
                  </div>
                )}

                {/* Real-time transcribed text display section */}
                {voiceText && voiceInputType === 'mic' && (
                  <div className="w-full text-center bg-zinc-50 rounded-2xl p-4 border border-zinc-150 animate-fade-in relative">
                    <span className="text-[9px] uppercase font-bold text-zinc-400 absolute top-2 right-3 font-mono">Đang nghe ra:</span>
                    <p className="text-zinc-800 font-bold text-xs leading-normal italic text-left pt-2">
                      "{voiceText}"
                    </p>

                    <button
                      onClick={() => submitVoiceCommand()}
                      disabled={voiceLoading}
                      className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs shadow-sm"
                    >
                      {voiceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      <span>Thực hiện lệnh này qua Gemini AI</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Voice instruction preset buttons */}
              <div className="mt-2 pt-3 border-t border-zinc-150 shrink-0">
                <span className="text-[9px] font-bold text-zinc-400 font-mono tracking-wider uppercase block mb-1.5 text-left">CHỌN CÂU NÓI CÓ SẴN (PHÒNG THỬ NGHIỆM):</span>
                <div className="space-y-1.5">
                  {voiceCommands.map((command, idx) => (
                    <button 
                      key={idx}
                      onClick={async () => {
                        setVoiceText(command.speech);
                        await submitVoiceCommand(command.speech);
                      }}
                      className="w-full text-left p-2.5 border border-zinc-150 rounded-xl bg-zinc-50/50 hover:bg-green-50/30 hover:border-green-300 transition-all flex flex-col gap-0.5 active:scale-98 cursor-pointer"
                    >
                      <p className="font-bold text-zinc-805 text-[10px] line-clamp-1 pb-0.5 text-zinc-700">
                        "{command.speech}"
                      </p>
                      <span className="text-[9px] text-zinc-400 font-semibold italic">↳ {command.actionDesc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

