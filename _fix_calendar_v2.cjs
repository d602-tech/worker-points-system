const fs = require('fs');
const path = 'client/src/pages/worker/CalendarOverview.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Update imports
c = c.replace(
    /import {[\s\n]+format, startOfMonth, endOfMonth, eachDayOfInterval,[\s\n]+isToday, getDay, isBefore, startOfDay, addMonths,[\s\n]+} from "date-fns";/,
    `import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, getDay, isBefore, startOfDay, addMonths, parseISO,
} from "date-fns";`
);
c = c.replace(
    /import { POINTS_CONFIG_SEED } from "..\/..\/..\/..\/shared\/domain";/,
    'import { POINTS_CONFIG_SEED, CONTRACT_START } from "../../../../shared/domain";'
);

// 2. Update estimatedPoints calculation
c = c.replace(
    /const isHoliday = TW_HOLIDAYS_2026\.has\(dateStr\);\n\s+const isOff = isWeekend \|\| isHoliday;/,
    `const isHoliday = TW_HOLIDAYS_2026.has(dateStr);
      const isBeforeContract = isBefore(d, parseISO(CONTRACT_START));
      const isOff = isWeekend || isHoliday || isBeforeContract;`
);

// 3. Update dailyIncomplete logic
c = c.replace(
    /const isHoliday = TW_HOLIDAYS_2026\.has\(dateStr\);\n\s+const att = attendanceMap\[dateStr\];/,
    `const isHoliday = TW_HOLIDAYS_2026.has(dateStr);
      const isBeforeContract = isBefore(day, parseISO(CONTRACT_START));
      const att = attendanceMap[dateStr];`
);
c = c.replace(
    /const isWorkDay = !isWeekend && !isHoliday;\n\s+if \(!isPastDay \|\| !isWorkDay\) return false;/,
    `const isWorkDay = !isWeekend && !isHoliday && !isBeforeContract;
      if (!isPastDay || !isWorkDay) return false;`
);

fs.writeFileSync(path, c);
console.log('CalendarOverview.tsx updated successfully.');
