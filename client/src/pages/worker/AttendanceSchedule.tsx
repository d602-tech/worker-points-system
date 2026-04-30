import { useState, useEffect, useMemo } from "react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameMonth, startOfWeek, endOfWeek, isBefore, parseISO } from "date-fns";
import { Save, Clock, CalendarDays, AlertCircle, Loader2, Briefcase, Palmtree, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { gasGet, batchUpsertAttendance } from "@/lib/gasApi";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { CONTRACT_START } from "../../../../shared/domain";

// 115年國定假日 (2026)
const HOLIDAYS_2026 = [
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18',
  '2026-02-19','2026-02-20','2026-02-27','2026-04-03',
  '2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-10-09',
];

const TIME_OPTIONS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

interface DayRecord {
  date: string;
  isStandardWorkday: boolean;
  workHours: number;
  leaveHours: number;
  leaveType: string;
  leaveTime: string;
  modifyReason: string;
  isFinalized: boolean;
  swapDate?: string;
}

export default function AttendanceSchedule() {
  const { user } = useGasAuthContext();
  const [currentMonth, setCurrentMonth] = useState(() => addMonths(new Date(), 1));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 以 YYYY-MM-DD 為 key 的每日資料
  const [scheduleData, setScheduleData] = useState<Record<string, DayRecord>>({});
  const [originalScheduleData, setOriginalScheduleData] = useState<Record<string, DayRecord>>({});
  
  // 儲存確認對話框狀態
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [changesToSave, setChangesToSave] = useState<{date: string; diff: string; reason: string}[]>([]);
  
  // 對話框狀態
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogWorkHours, setDialogWorkHours] = useState<number>(8);
  const [dialogLeaveHours, setDialogLeaveHours] = useState<number>(0);
  const [dialogLeaveType, setDialogLeaveType] = useState<string>("無");
  const [dialogLeaveTimeStart, setDialogLeaveTimeStart] = useState<string>("08:00");
  const [dialogLeaveTimeEnd, setDialogLeaveTimeEnd] = useState<string>("12:00");
  const [dialogModifyReason, setDialogModifyReason] = useState<string>("");
  const [dialogSwapDate, setDialogSwapDate] = useState<string>("");

  // 當選擇請假時間後，自動計算請假時數
  const handleTimeChange = (type: "start" | "end", val: string) => {
    let s = type === "start" ? val : dialogLeaveTimeStart;
    let e = type === "end" ? val : dialogLeaveTimeEnd;
    
    if (type === "start") setDialogLeaveTimeStart(val);
    else setDialogLeaveTimeEnd(val);

    const sHour = parseInt(s.split(":")[0]);
    const eHour = parseInt(e.split(":")[0]);

    if (eHour <= sHour) {
      setDialogLeaveHours(0);
      return;
    }

    let hours = 0;
    for (let h = sHour; h < eHour; h++) {
      if (h !== 12) hours++; // 排除中午 12:00~13:00 休息時間
    }
    
    setDialogLeaveHours(hours);
    
    // 如果目前上班時數 + 新的請假時數 > 8，自動調低上班時數
    if (dialogWorkHours + hours > 8) {
      setDialogWorkHours(Math.max(0, 8 - hours));
    }
  };

  const handleLeaveHoursInput = (h: number) => {
    setDialogLeaveHours(h);
    if (h > 0 && dialogLeaveType === "無") {
      setDialogLeaveType("特休");
    }
    
    // 自動計算請假時間：起始 08:00，跳過 12:00~13:00 午休
    if (h > 0) {
      let endHour = 8;
      let remaining = h;
      while (remaining > 0 && endHour < 17) {
        if (endHour === 12) { endHour = 13; continue; }
        endHour++;
        remaining--;
      }
      setDialogLeaveTimeStart("08:00");
      setDialogLeaveTimeEnd(`${String(endHour).padStart(2, "0")}:00`);
    }
    
    // 自動調低上班時數
    if (dialogWorkHours + h > 8) {
      setDialogWorkHours(Math.max(0, 8 - h));
    }
  };

  // 初始化當月資料
  const initMonthData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const yearMonth = format(currentMonth, "yyyy-MM");
      const res = await gasGet<any>("getAttendance", {
        callerEmail: user.email,
        workerId: user.id,
        yearMonth
      });
      
      if (!res.success) {
        throw new Error(res.error || "未知錯誤");
      }
      
      const newSchedule: Record<string, DayRecord> = {};
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      // 建立預設班表
      days.forEach(day => {
        const dStr = format(day, "yyyy-MM-dd");
        const isWknd = isWeekend(day);
        const isHol = HOLIDAYS_2026.includes(dStr);
        const isStandardWorkday = !isWknd && !isHol && !isBefore(day, parseISO(CONTRACT_START));
        
        newSchedule[dStr] = {
          date: dStr,
          isStandardWorkday,
          workHours: isStandardWorkday ? 8 : 0,
          leaveHours: 0,
          leaveType: "無",
          leaveTime: "",
          modifyReason: "",
          isFinalized: false
        };
      });

      // 覆寫已有的後端資料
      if (res.success && res.data && Array.isArray(res.data)) {
        res.data.forEach((r: any) => {
          let dStr = r["日期"] || r.date;
          if (dStr && typeof dStr === "string") dStr = dStr.substring(0, 10);
          else if (dStr instanceof Date) dStr = format(dStr, "yyyy-MM-dd");
          
          if (newSchedule[dStr]) {
            const am = r["上午狀態"] || r.amStatus || "／";
            const pm = r["下午狀態"] || r.pmStatus || "／";
            const leaveTimeStr = r["請假時間"] || r.leaveTime || "";
            const modifyReasonStr = r["修改原因"] || r.modifyReason || "";
            
            let totalWork = 0;
            let totalLeave = 0;
            let currentLeaveType = "無";

            const parseStatus = (s: any) => {
              const str = String(s || "").trim();
              if (str === "／" || str === "出勤" || str.startsWith("代")) return { w: 4, l: 0, t: "無" };
              if (str === "調") return { w: 0, l: 0, t: "調班" };
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

            // 從備註或修改原因恢復調班狀態
            const noteStr = String(r["備註"] || r.note || "");
            if (noteStr === "調班" || String(modifyReasonStr).includes("調班") || String(modifyReasonStr).includes("對調") || currentLeaveType === "調班") {
              currentLeaveType = "調班";
            }

            newSchedule[dStr] = {
              ...newSchedule[dStr],
              workHours: totalWork,
              leaveHours: totalLeave,
              leaveType: currentLeaveType,
              leaveTime: leaveTimeStr,
              modifyReason: modifyReasonStr,
              isFinalized: String(r["鎖定狀態"] || r["已確認"] || r["isFinalized"]) === "true"
            };
          }
        });
      }
      setScheduleData(newSchedule);
      // 深拷貝一份做為原始資料比對使用
      setOriginalScheduleData(JSON.parse(JSON.stringify(newSchedule)));
    } catch (e: any) {
      toast.error("載入差勤資料失敗: " + (e.message || ""));
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

  const handleSaveClick = () => {
    const changes: {date: string; diff: string; reason: string}[] = [];
    Object.keys(scheduleData).forEach(date => {
      const current = scheduleData[date];
      const original = originalScheduleData[date];
      
      // 比對是否有實質修改
      if (
        current.workHours !== original?.workHours ||
        current.leaveHours !== original?.leaveHours ||
        current.leaveType !== original?.leaveType
      ) {
        const oldStatus = original?.workHours === 8 ? "正常上班" : (original?.workHours === 0 && original?.leaveHours === 0 ? "休假" : `上班 ${original?.workHours}h / ${original?.leaveType} ${original?.leaveHours}h`);
        const newStatus = current.workHours === 8 ? "正常上班" : (current.workHours === 0 && current.leaveHours === 0 ? "休假" : `上班 ${current.workHours}h / ${current.leaveType} ${current.leaveHours}h`);
        
        changes.push({
          date,
          diff: `從「${oldStatus}」改為「${newStatus}」`,
          reason: current.modifyReason || "無填寫"
        });
      }
    });

    if (changes.length === 0) {
      toast.info("排班資料無異動，不需儲存");
      return;
    }

    // 驗證上班天數不能超過標準天數
    const scheduledWorkDays = Object.values(scheduleData).filter(r => r.workHours > 0).length;
    if (scheduledWorkDays > stats.standardDays) {
      toast.error(`排定上班天數 (${scheduledWorkDays}) 超過標準天數 (${stats.standardDays})，請調整排班`);
      return;
    }

    setChangesToSave(changes);
    setShowConfirmDialog(true);
  };

  const executeSave = async () => {
    if (!user) return;
    
    setShowConfirmDialog(false);
    setIsSaving(true);
    try {
      // 只送出有實質變更的天數，避免全月重寫
      const recordsToSave = Object.values(scheduleData)
        .filter(record => {
          const orig = originalScheduleData[record.date];
          if (!orig) return true;
          return record.workHours !== orig.workHours
            || record.leaveHours !== orig.leaveHours
            || record.leaveType !== orig.leaveType
            || record.modifyReason !== orig.modifyReason;
        })
        .map(record => {
        let amStatus = "／";
        let pmStatus = "／";
        
        if (record.leaveType === "調班") {
            // 調班專用編碼
            if (record.workHours === 0) { amStatus = "調"; pmStatus = "調"; }
            else { amStatus = "／"; pmStatus = "／"; }
          } else if (record.workHours === 8) {
            amStatus = "／"; pmStatus = "／";
          } else if (record.workHours === 0 && record.leaveHours === 0) {
            amStatus = ""; pmStatus = "";
        } else {
          const typePrefix = record.leaveType.charAt(0) === "無" ? "" : record.leaveType.charAt(0);
          
          if (record.leaveHours > 0) {
            if (record.leaveHours <= 4) {
              amStatus = `${typePrefix}${record.leaveHours}`;
              pmStatus = "／"; 
            } else {
              amStatus = `${typePrefix}4`;
              const pmLeave = record.leaveHours - 4;
              pmStatus = `${typePrefix}${pmLeave}`;
            }
          } else {
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
          "人員編號": user.id, // Updated to match backend column name accurately
          "日期": record.date,
          "上午狀態": amStatus,
          "下午狀態": pmStatus,
          "備註": record.leaveType !== "無" ? record.leaveType : "",
          "請假時間": record.leaveHours > 0 ? record.leaveTime : "",
          "修改原因": record.modifyReason
        };
      });

      // 確保將 user.email 作為 callerEmail 傳遞
      const res = await batchUpsertAttendance(user.email, recordsToSave);
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
    setDialogModifyReason(record.modifyReason || "");
    setDialogSwapDate("");
    
    if (record.leaveTime) {
      const [s, e] = record.leaveTime.split("~");
      if (s && e) {
        setDialogLeaveTimeStart(s);
        setDialogLeaveTimeEnd(e);
      }
    } else {
      setDialogLeaveTimeStart("08:00");
      setDialogLeaveTimeEnd("12:00");
    }
  };

  // 取得當月所有假日（週末+國定假日）供調班選擇
  const availableHolidays = useMemo(() => {
    const monthStart2 = startOfMonth(currentMonth);
    const monthEnd2 = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start: monthStart2, end: monthEnd2 });
    return allDays.filter(d => {
      const dStr = format(d, "yyyy-MM-dd");
      const rec = scheduleData[dStr];
      // 是假日且尚未被調班成上班日
      return rec && !rec.isStandardWorkday && rec.workHours === 0;
    }).map(d => format(d, "yyyy-MM-dd"));
  }, [currentMonth, scheduleData]);

  const handleDialogSave = () => {
    if (!selectedDate) return;
    
    // 調班邏輯
    if (dialogLeaveType === "調班") {
      if (!dialogSwapDate) {
        toast.error("請選擇要對調的假日日期");
        return;
      }
      if (!dialogModifyReason.trim()) {
        toast.error("調班請務必填寫原因");
        return;
      }
      setScheduleData(prev => ({
        ...prev,
        // 原上班日 → 休假
        [selectedDate]: {
          ...prev[selectedDate],
          workHours: 0,
          leaveHours: 0,
          leaveType: "調班",
          leaveTime: "",
          modifyReason: `${dialogModifyReason}（與 ${dialogSwapDate} 對調）`,
          swapDate: dialogSwapDate
        },
        // 選定假日 → 上班
        [dialogSwapDate]: {
          ...prev[dialogSwapDate],
          workHours: 8,
          leaveHours: 0,
          leaveType: "調班",
          leaveTime: "",
          modifyReason: `${dialogModifyReason}（與 ${selectedDate} 對調）`,
          swapDate: selectedDate
        }
      }));
      setSelectedDate(null);
      toast.success(`已將 ${selectedDate} 與 ${dialogSwapDate} 對調`);
      return;
    }

    if (dialogWorkHours + dialogLeaveHours > 8) {
      toast.error("單日總時數(上班+請假)不可超過 8 小時");
      return;
    }

    const leaveTimeStr = dialogLeaveHours > 0 ? `${dialogLeaveTimeStart}~${dialogLeaveTimeEnd}` : "";
    const record = scheduleData[selectedDate];
    
    // Check if changed from standard
    const isStandard = record.isStandardWorkday;
    const defaultWork = isStandard ? 8 : 0;
    const defaultLeave = 0;
    const isChanged = (dialogWorkHours !== defaultWork) || (dialogLeaveHours !== defaultLeave);

    if (isChanged && !dialogModifyReason.trim()) {
      toast.error("因排班與預設不同，請填寫修改原因");
      return;
    }

    setScheduleData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        workHours: dialogWorkHours,
        leaveHours: dialogLeaveHours,
        leaveType: dialogLeaveHours > 0 ? dialogLeaveType : "無",
        leaveTime: leaveTimeStr,
        modifyReason: dialogModifyReason
      }
    }));
    
    setSelectedDate(null);
  };

  // 渲染月曆
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); 
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;

    const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const formattedDate = format(day, dateFormat);
        const dStr = format(day, "yyyy-MM-dd");
        const record = scheduleData[dStr];
        const isCurrentMonth = isSameMonth(day, monthStart);
        
        let bgColorClass = "bg-white";
        let textColorClass = "text-foreground";
        
        if (record && isCurrentMonth) {
           if (record.leaveType === "調班") {
             bgColorClass = "bg-purple-100 border-purple-300";
             textColorClass = "text-purple-900 font-medium";
           } else if (record.workHours > 0) {
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
                {record.leaveType === "調班" && <div className="text-purple-600">↔ 調班</div>}
                {record.workHours === 0 && record.leaveHours === 0 && record.leaveType !== "調班" && <div>休</div>}
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
          <Button className="bg-blue-700 hover:bg-blue-800 gap-1.5" onClick={handleSaveClick} disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "儲存中..." : "儲存排班"}
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="w-[90%] max-w-[400px] rounded-3xl p-0 overflow-hidden bg-slate-50">
          <div className="bg-white px-6 py-5 border-b flex justify-between items-center">
            <div>
              <DialogTitle className="text-xl text-slate-800">差勤設定</DialogTitle>
              <DialogDescription className="text-sm mt-1">{selectedDate}</DialogDescription>
            </div>
          </div>
          
          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
             {/* 上班卡片 */}
             <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Briefcase className="w-16 h-16 text-blue-500" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                   <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                     <Briefcase className="w-4 h-4" />
                   </div>
                   <h3 className="font-bold text-blue-900 text-base">上班時數</h3>
                </div>
                <div className="relative z-10 flex items-center gap-4 bg-white/60 p-3 rounded-xl">
                   <Label className="text-blue-800 flex-1">填寫今日上班幾小時</Label>
                   <Input 
                      type="number" 
                      min="0" max="8" 
                      className="w-20 font-bold text-lg text-center bg-white border-blue-200 focus-visible:ring-blue-500"
                      value={dialogWorkHours} 
                      onChange={e => setDialogWorkHours(Number(e.target.value) || 0)} 
                   />
                </div>
             </div>

             {/* 請假卡片 */}
             <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Palmtree className="w-16 h-16 text-orange-500" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                   <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center">
                     <Palmtree className="w-4 h-4" />
                   </div>
                   <h3 className="font-bold text-orange-900 text-base">請假設定</h3>
                </div>
                
                <div className="relative z-10 space-y-3">
                   <div className="flex items-center gap-4 bg-white/60 p-3 rounded-xl">
                      <Label className="text-orange-900 flex-1">填寫今日請假時數</Label>
                      <Input 
                         type="number" 
                         min="0" max="8" 
                         className="w-20 font-bold text-lg text-center bg-white border-orange-200 focus-visible:ring-orange-500"
                         value={dialogLeaveHours} 
                         onChange={e => handleLeaveHoursInput(Number(e.target.value) || 0)} 
                      />
                   </div>

                   {dialogLeaveHours > 0 && (
                     <div className="bg-white/60 p-3 rounded-xl space-y-3 border border-orange-100">
                       <div className="flex items-center gap-2">
                         <Label className="text-orange-900 w-[60px]">假別</Label>
                         <Select value={dialogLeaveType} onValueChange={(v) => {
                            setDialogLeaveType(v);
                            if (v === "調班") {
                              setDialogModifyReason("調班");
                              setDialogLeaveHours(0);
                              setDialogWorkHours(0);
                            }
                          }}>
                           <SelectTrigger className="flex-1 bg-white border-orange-200">
                             <SelectValue placeholder="選擇假別" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="特休">特休</SelectItem>
                             <SelectItem value="事假">事假</SelectItem>
                             <SelectItem value="病假">病假</SelectItem>
                             <SelectItem value="公假">公假</SelectItem>
                             <SelectItem value="婚假">婚假</SelectItem>
                             <SelectItem value="喪假">喪假</SelectItem>
                           <SelectItem value="調班">調班（與假日對調）</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="flex items-center gap-2">
                         <Label className="text-orange-900 w-[60px]">時間</Label>
                         <div className="flex-1 flex items-center gap-2">
                           <Select value={dialogLeaveTimeStart} onValueChange={v => handleTimeChange("start", v)}>
                             <SelectTrigger className="bg-white border-orange-200"><SelectValue/></SelectTrigger>
                             <SelectContent>
                               {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                             </SelectContent>
                           </Select>
                           <span className="text-orange-400 font-bold">~</span>
                           <Select value={dialogLeaveTimeEnd} onValueChange={v => handleTimeChange("end", v)}>
                             <SelectTrigger className="bg-white border-orange-200"><SelectValue/></SelectTrigger>
                             <SelectContent>
                               {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                       <p className="text-[10px] text-orange-600/70 pl-[68px]">選擇區間後會自動計算時數 (扣除12:00~13:00休息)</p>
                     </div>
                   )}
                </div>
             </div>
             {/* 調班卡片 (選擇調班時顯示) */}
             {dialogLeaveType === "調班" && (
               <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 shadow-sm">
                 <div className="flex items-center gap-2 mb-3">
                   <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center">
                     <ArrowLeftRight className="w-4 h-4" />
                   </div>
                   <h3 className="font-bold text-purple-900 text-base">選擇對調假日</h3>
                 </div>
                 <p className="text-xs text-purple-700 mb-2">
                   將本日（上班日）與下方選擇的假日對調：本日改為休假，選定假日改為上班。
                 </p>
                 <Select value={dialogSwapDate} onValueChange={setDialogSwapDate}>
                   <SelectTrigger className="bg-white border-purple-200">
                     <SelectValue placeholder="請選擇要對調的假日" />
                   </SelectTrigger>
                   <SelectContent>
                     {availableHolidays.length === 0 && (
                       <SelectItem value="_none" disabled>本月無可對調的假日</SelectItem>
                     )}
                     {availableHolidays.map(h => {
                       const d = new Date(h);
                       const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
                       const isHol = HOLIDAYS_2026.includes(h);
                       const label = h + " (" + dayNames[d.getDay()] + (isHol ? " 國定假日" : " 週末") + ")";
                       return <SelectItem key={h} value={h}>{label}</SelectItem>;
                     })}
                   </SelectContent>
                 </Select>
               </div>
             )}

             {/* 修改原因卡片 (動態顯示) */}
             {selectedDate && scheduleData[selectedDate] && (
               (() => {
                 const record = scheduleData[selectedDate];
                 const isStandard = record.isStandardWorkday;
                 const defaultWork = isStandard ? 8 : 0;
                 const defaultLeave = 0;
                 const isChanged = (dialogWorkHours !== defaultWork) || (dialogLeaveHours !== defaultLeave);

                 if (isChanged) {
                   return (
                     <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                       <Label className="text-slate-700 font-bold mb-2 block">修改原因 <span className="text-red-500">*</span></Label>
                       <Input 
                         type="text" 
                         placeholder="請說明修改班表的原因 (例如: 加班、調班...)"
                         className="bg-white border-slate-200"
                         value={dialogModifyReason}
                         onChange={e => setDialogModifyReason(e.target.value)}
                       />
                       <p className="text-[10px] text-slate-500 mt-2">因您的排班與預設不同，請務必填寫原因</p>
                     </div>
                   );
                 }
                 return null;
               })()
             )}

             <div className="px-1 text-slate-500 text-xs flex gap-2">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <p>若該日為休假不上班，請將上班與請假時數皆設為 0。</p>
             </div>
          </div>

          <div className="bg-white px-6 py-4 border-t flex justify-end gap-3">
            <Button variant="ghost" className="text-slate-500" onClick={() => setSelectedDate(null)}>取消</Button>
            <Button onClick={handleDialogSave} className="bg-blue-700 hover:bg-blue-800">確認修改</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 儲存確認對話框 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>確認儲存排班異動</DialogTitle>
            <DialogDescription>
              以下是您本次修改的差勤紀錄，確認無誤後將送出並記錄於系統中。
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[300px] overflow-y-auto space-y-3 py-2">
            {changesToSave.map((change, idx) => (
              <div key={idx} className="p-3 bg-muted/40 rounded-lg border border-border/50 text-sm">
                <div className="font-bold text-foreground mb-1">{change.date}</div>
                <div className="text-blue-700">{change.diff}</div>
                <div className="text-muted-foreground mt-1 text-xs">修改原因：{change.reason}</div>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>取消</Button>
            <Button onClick={executeSave} className="bg-blue-700 hover:bg-blue-800 gap-1.5">
              <Save className="w-4 h-4" /> 確認並送出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
