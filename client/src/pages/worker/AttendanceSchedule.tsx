import { useState, useEffect, useMemo } from "react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameMonth, parseISO, startOfWeek, endOfWeek, getDay } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Save, Clock, CalendarDays, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { gasGet, batchUpsertAttendance } from "@/lib/gasApi";
import { useGasAuthContext } from "@/lib/useGasAuth";

// 115年國定假日 (2026)
const HOLIDAYS_2026 = [
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18',
  '2026-02-19','2026-02-20','2026-02-27','2026-04-03',
  '2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-10-09',
];

interface DayRecord {
  date: string;
  isStandardWorkday: boolean;
  workHours: number;
  leaveHours: number;
  leaveType: string;
  isFinalized: boolean;
}

export default function AttendanceSchedule() {
  const { user } = useGasAuthContext();
  const [currentMonth, setCurrentMonth] = useState(() => addMonths(new Date(), 1));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 以 YYYY-MM-DD 為 key 的每日資料
  const [scheduleData, setScheduleData] = useState<Record<string, DayRecord>>({});
  
  // 對話框狀態
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogWorkHours, setDialogWorkHours] = useState<number>(8);
  const [dialogLeaveHours, setDialogLeaveHours] = useState<number>(0);
  const [dialogLeaveType, setDialogLeaveType] = useState<string>("無");

  // 初始化當月資料
  const initMonthData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const yearMonth = format(currentMonth, "yyyy-MM");
      const res = await gasGet<any>("getAttendance", {
        workerId: user.id,
        yearMonth
      });
      
      const newSchedule: Record<string, DayRecord> = {};
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      // 建立預設班表
      days.forEach(day => {
        const dStr = format(day, "yyyy-MM-dd");
        const isWknd = isWeekend(day);
        const isHol = HOLIDAYS_2026.includes(dStr);
        const isStandardWorkday = !isWknd && !isHol;
        
        newSchedule[dStr] = {
          date: dStr,
          isStandardWorkday,
          workHours: isStandardWorkday ? 8 : 0,
          leaveHours: 0,
          leaveType: "無",
          isFinalized: false
        };
      });

      // 覆寫已有的後端資料
      if (res.success && res.data && Array.isArray(res.data)) {
        res.data.forEach((r: any) => {
          let dStr = r["日期"];
          if (dStr && typeof dStr === "string") dStr = dStr.substring(0, 10);
          else if (dStr instanceof Date) dStr = format(dStr, "yyyy-MM-dd");
          
          if (newSchedule[dStr]) {
            const wh = parseFloat(r["時數"] || r["工作時數"] || r["workHours"] || "0"); // Handle different column names
            // Actually in our GAS we have "時數" or "請假時數" etc? 
            // wait, we changed calcWorkAndLeave but let's parse from AM/PM status
            const am = r["上午狀態"] || "／";
            const pm = r["下午狀態"] || "／";
            
            let totalWork = 0;
            let totalLeave = 0;
            let currentLeaveType = "無";

            const parseStatus = (s: string) => {
              const str = (s || "").trim();
              if (str === "／" || str === "出勤" || str.startsWith("代")) return { w: 4, l: 0, t: "無" };
              const m = str.match(/^(特|病|事|婚|喪|公)(\d+(\.\d+)?)?$/);
              if (m) {
                const h = parseFloat(m[2]) || 4;
                return { w: Math.max(0, 4 - h), l: h, t: m[1] };
              }
              return { w: 0, l: 0, t: "無" };
            };
            
            const amParsed = parseStatus(am);
            const pmParsed = parseStatus(pm);
            
            totalWork = amParsed.w + pmParsed.w;
            totalLeave = amParsed.l + pmParsed.l;
            currentLeaveType = amParsed.t !== "無" ? amParsed.t : (pmParsed.t !== "無" ? pmParsed.t : "無");
            if (currentLeaveType === "特") currentLeaveType = "特休";
            else if (currentLeaveType === "病") currentLeaveType = "病假";
            else if (currentLeaveType === "事") currentLeaveType = "事假";
            else if (currentLeaveType === "婚") currentLeaveType = "婚假";
            else if (currentLeaveType === "喪") currentLeaveType = "喪假";
            else if (currentLeaveType === "公") currentLeaveType = "公假";

            // If the record exists, we use it
            newSchedule[dStr] = {
              ...newSchedule[dStr],
              workHours: totalWork,
              leaveHours: totalLeave,
              leaveType: currentLeaveType,
              isFinalized: String(r["鎖定狀態"] || r["已確認"] || r["isFinalized"]) === "true"
            };
          }
        });
      }
      setScheduleData(newSchedule);
    } catch (e) {
      toast.error("載入差勤資料失敗");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initMonthData();
  }, [currentMonth, user]);

  // 計算統計
  const stats = useMemo(() => {
    let standardDays = 0;
    let scheduledWorkHours = 0;
    let specialLeaveHours = 0;
    
    Object.values(scheduleData).forEach(record => {
      if (record.isStandardWorkday) standardDays++;
      scheduledWorkHours += record.workHours;
      if (record.leaveType === "特休" || record.leaveType === "特") {
        specialLeaveHours += record.leaveHours;
      }
    });

    return {
      standardWorkHours: standardDays * 8,
      standardDays,
      scheduledWorkHours,
      specialLeaveHours
    };
  }, [scheduleData]);

  const handleSave = async () => {
    if (!user) return;
    
    // 防呆：檢查總工時是否符合標準（允許加上特休時數? 選項B允許時數不合，但提示）
    // 依據 Option B，調班總天數維持，但我們在這裡就存入
    
    setIsSaving(true);
    try {
      const recordsToSave = Object.values(scheduleData).map(record => {
        // 將 workHours 和 leaveHours 轉回 AM/PM status
        let amStatus = "／";
        let pmStatus = "／";
        
        if (record.workHours === 8) {
          amStatus = "／"; pmStatus = "／";
        } else if (record.workHours === 0 && record.leaveHours === 0) {
          amStatus = ""; pmStatus = "";
        } else {
          // 有請假或部分工時
          const typePrefix = record.leaveType.charAt(0) === "無" ? "" : record.leaveType.charAt(0);
          
          if (record.leaveHours > 0) {
            if (record.leaveHours <= 4) {
              amStatus = `${typePrefix}${record.leaveHours}`;
              pmStatus = "／"; // 假設下午正常
            } else {
              amStatus = `${typePrefix}4`;
              const pmLeave = record.leaveHours - 4;
              pmStatus = `${typePrefix}${pmLeave}`;
            }
          } else {
             // 週末加班但時數小於8
             if (record.workHours <= 4) {
               amStatus = "出勤";
               pmStatus = "";
             } else {
               amStatus = "出勤";
               pmStatus = "出勤";
             }
          }
        }

        return {
          "工號": user.id,
          "日期": record.date,
          "上午狀態": amStatus,
          "下午狀態": pmStatus,
          "備註": record.leaveType !== "無" ? record.leaveType : ""
        };
      });

      const res = await batchUpsertAttendance(recordsToSave);
      if (res.success) {
        toast.success("班表儲存成功！");
        initMonthData();
      } else {
        toast.error("儲存失敗: " + res.error);
      }
    } catch (e) {
      toast.error("儲存發生錯誤");
    } finally {
      setIsSaving(false);
    }
  };

  const openDayDialog = (dateStr: string) => {
    const record = scheduleData[dateStr];
    if (!record) return;
    if (record.isFinalized) {
      toast.error("該日差勤已鎖定，無法修改");
      return;
    }
    setSelectedDate(dateStr);
    setDialogWorkHours(record.workHours);
    setDialogLeaveHours(record.leaveHours);
    setDialogLeaveType(record.leaveType || "無");
  };

  const handleDialogSave = () => {
    if (!selectedDate) return;
    
    if (dialogWorkHours + dialogLeaveHours > 8) {
      toast.error("單日總時數(上班+請假)不可超過 8 小時");
      return;
    }

    setScheduleData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        workHours: dialogWorkHours,
        leaveHours: dialogLeaveHours,
        leaveType: dialogLeaveHours > 0 ? dialogLeaveType : "無"
      }
    }));
    
    setSelectedDate(null);
  };

  // 渲染月曆
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // 週一開始
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const dStr = format(day, "yyyy-MM-dd");
        const record = scheduleData[dStr];
        const isCurrentMonth = isSameMonth(day, monthStart);
        
        let bgColorClass = "bg-white";
        let textColorClass = "text-foreground";
        
        if (record && isCurrentMonth) {
           if (record.workHours > 0) {
             bgColorClass = "bg-blue-100 border-blue-300";
             textColorClass = "text-blue-900 font-medium";
           } else if (record.workHours === 0 && !record.isStandardWorkday && record.leaveHours === 0) {
             bgColorClass = "bg-red-50 border-red-200";
             textColorClass = "text-red-700";
           } else if (record.leaveHours > 0) {
             bgColorClass = "bg-orange-100 border-orange-300";
             textColorClass = "text-orange-900";
           }
        } else if (!isCurrentMonth) {
          bgColorClass = "bg-muted/30";
          textColorClass = "text-muted-foreground/40";
        }

        const cloneDay = dStr;
        days.push(
          <div
            key={day.toString()}
            onClick={() => isCurrentMonth && openDayDialog(cloneDay)}
            className={cn(
              "min-h-[70px] border p-1 transition-all",
              isCurrentMonth ? "cursor-pointer hover:shadow-md" : "opacity-50 cursor-default",
              bgColorClass
            )}
          >
            <div className="flex justify-between items-start">
               <span className={cn("text-sm", textColorClass)}>{formattedDate}</span>
               {record && isCurrentMonth && record.isFinalized && (
                 <span className="text-[10px] text-muted-foreground">🔒</span>
               )}
            </div>
            {record && isCurrentMonth && (
              <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-center font-medium opacity-80">
                {record.workHours > 0 && <div>班 {record.workHours}h</div>}
                {record.leaveHours > 0 && <div className="text-orange-600">{record.leaveType} {record.leaveHours}h</div>}
                {record.workHours === 0 && record.leaveHours === 0 && <div>休</div>}
              </div>
            )}
          </div>
        );
        day = new Date(day.setDate(day.getDate() + 1));
      }
      rows.push(
        <div className="grid grid-cols-7 gap-1 mb-1" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="w-full">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(d => (
            <div key={d} className="text-center font-bold text-xs text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>
        {rows}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-full pb-[120px] bg-slate-50/50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/50 px-5 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shadow-inner">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">差勤排班系統</h1>
            <p className="text-xs text-muted-foreground font-medium">預排班表與請假</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>上月</Button>
           <span className="font-semibold text-sm w-[70px] text-center">{format(currentMonth, "yyyy-MM")}</span>
           <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>下月</Button>
        </div>
      </div>

      <div className="p-4 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}
        
        <div className="bg-white rounded-2xl shadow-elegant border border-border/50 p-4">
           {renderCalendar()}
        </div>
      </div>

      {/* Bottom Fixed Summary Bar */}
      <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-border shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] p-4 z-40">
        <div className="flex justify-between items-center mb-3">
          <div className="flex flex-col gap-1 text-sm font-medium">
            <div className="text-slate-700">
               排定上班: <span className="text-blue-700 font-bold">{Math.floor(stats.scheduledWorkHours / 8)}</span> 天 <span className="text-blue-700 font-bold">{stats.scheduledWorkHours % 8}</span> 小時 
               <span className="text-muted-foreground text-xs ml-1">/ 標準: {stats.standardDays} 天</span>
            </div>
            {stats.specialLeaveHours > 0 && (
              <div className="text-orange-600">
                 特休: <span className="font-bold">{Math.floor(stats.specialLeaveHours / 8)}</span> 天 <span className="font-bold">{stats.specialLeaveHours % 8}</span> 小時
              </div>
            )}
          </div>
          <Button 
            className="bg-blue-700 hover:bg-blue-800 shadow-md gap-2" 
            onClick={handleSave} 
            disabled={isSaving || isLoading}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            儲存班表
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="w-[90%] max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>設定差勤時數</DialogTitle>
            <DialogDescription>日期：{selectedDate}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
             <div className="space-y-2">
                <Label>上班時數 (小時)</Label>
                <Input 
                   type="number" 
                   min="0" max="8" 
                   value={dialogWorkHours} 
                   onChange={e => setDialogWorkHours(Number(e.target.value) || 0)} 
                />
             </div>

             <div className="space-y-2">
                <Label>請假時數 (小時)</Label>
                <Input 
                   type="number" 
                   min="0" max="8" 
                   value={dialogLeaveHours} 
                   onChange={e => {
                     const h = Number(e.target.value) || 0;
                     setDialogLeaveHours(h);
                     if (h > 0 && dialogLeaveType === "無") {
                        setDialogLeaveType("特休");
                     }
                   }} 
                />
             </div>

             {dialogLeaveHours > 0 && (
               <div className="space-y-2">
                 <Label>請假類別</Label>
                 <Select value={dialogLeaveType} onValueChange={setDialogLeaveType}>
                   <SelectTrigger>
                     <SelectValue placeholder="選擇假別" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="特休">特休</SelectItem>
                     <SelectItem value="事假">事假</SelectItem>
                     <SelectItem value="病假">病假</SelectItem>
                     <SelectItem value="公假">公假</SelectItem>
                     <SelectItem value="婚假">婚假</SelectItem>
                     <SelectItem value="喪假">喪假</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
             )}

             <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-xl flex gap-2 mt-4">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <p>若該日為休假不上班，請將上班與請假時數皆設為 0。</p>
             </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDate(null)}>取消</Button>
            <Button onClick={handleDialogSave} className="bg-blue-700 hover:bg-blue-800">確認</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
