const fs = require('fs');
const path = 'client/src/pages/worker/AttendanceSchedule.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Update imports
c = c.replace(
    /import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameMonth, startOfWeek, endOfWeek } from "date-fns";/,
    'import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameMonth, startOfWeek, endOfWeek, isBefore, parseISO } from "date-fns";'
);
c = c.replace(
    /import { useGasAuthContext } from ".\/lib\/useGasAuth";/,
    'import { useGasAuthContext } from "@/lib/useGasAuth";\nimport { CONTRACT_START } from "../../../../shared/domain";'
);

// 2. Update initMonthData: error handling
c = c.replace(
    /const res = await gasGet<any>\("getAttendance", \{\n\s+callerEmail: user\.email,\n\s+workerId: user\.id,\n\s+yearMonth\n\s+\}\);/,
    `const res = await gasGet<any>("getAttendance", {
        callerEmail: user.email,
        workerId: user.id,
        yearMonth
      });
      
      if (!res.success) {
        throw new Error(res.error || "未知錯誤");
      }`
);

// 3. Update initMonthData: contract date restriction
c = c.replace(
    /const isStandardWorkday = !isWknd && !isHol;/,
    `const isStandardWorkday = !isWknd && !isHol && !isBefore(day, parseISO(CONTRACT_START));`
);

// 4. Update initMonthData: detailed error toast
c = c.replace(
    /\} catch \(e\) \{\n\s+toast\.error\("載入差勤資料失敗"\);\n\s+\}/,
    `} catch (e: any) {
      toast.error("載入差勤資料失敗: " + (e.message || ""));
    }`
);

fs.writeFileSync(path, c);
console.log('AttendanceSchedule.tsx updated successfully.');
