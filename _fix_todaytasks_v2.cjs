const fs = require('fs');
const path = 'client/src/pages/worker/TodayTasks.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Update imports
c = c.replace(
    /import { POINTS_CONFIG_SEED, WORKER_TYPE_LABELS } from "..\/..\/..\/..\/shared\/domain";/,
    'import { POINTS_CONFIG_SEED, WORKER_TYPE_LABELS, CONTRACT_START } from "../../../../shared/domain";'
);

// 2. Add isBeforeContract logic
c = c.replace(
    /const isFinalized = tasks\.every\(t => t\.status === "submitted" \|\| t\.status === "approved"\);/,
    `const isFinalized = tasks.every(t => t.status === "submitted" || t.status === "approved");
  const isBeforeContract = isBefore(startOfDay(currentDate), startOfDay(parseISO(CONTRACT_START)));`
);

// 3. Update task list rendering to show message if before contract
c = c.replace(
    /isLoading \? \(/,
    `isLoading ? (
        ) : isBeforeContract ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-800">尚未進入合約期</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本案合約自 {CONTRACT_START} 開始。<br />
                在此日期之前的作業項目不予計點與填報。
              </p>
            </div>
          </div>
        ) : (`
);
// Match the corresponding part for the ternary
// The structure is: isLoading ? (...) : isPastFinalized ? (...) : tasks.map(...)
// I'll need to be careful with the nesting.

// Actually, I'll just replace the whole Task List container content.
// Current: {isLoading ? (...) : isPastFinalized ? (...) : tasks.map(...)}
// New: {isLoading ? (...) : isBeforeContract ? (...) : isPastFinalized ? (...) : tasks.map(...)}

// Let's refine the replacement to be safer.
c = fs.readFileSync(path, 'utf8'); // Re-read to be sure
c = c.replace(
    /import { POINTS_CONFIG_SEED, WORKER_TYPE_LABELS } from "..\/..\/..\/..\/shared\/domain";/,
    'import { POINTS_CONFIG_SEED, WORKER_TYPE_LABELS, CONTRACT_START } from "../../../../shared/domain";'
);
c = c.replace(
    /const isFinalized = tasks\.every\(t => t\.status === "submitted" \|\| t\.status === "approved"\);/,
    `const isFinalized = tasks.every(t => t.status === "submitted" || t.status === "approved");
  const isBeforeContract = isBefore(startOfDay(currentDate), startOfDay(parseISO(CONTRACT_START)));`
);

const beforeContractPanel = `isBeforeContract ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-800">尚未進入合約期</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                本案合約自 {CONTRACT_START} 開始。<br />
                在此日期之前的作業項目不予計點與填報。
              </p>
            </div>
          </div>
        ) : `;

c = c.replace(
    /isLoading \? \([\s\S]+?\) : isPastFinalized \? \(/,
    (match) => match.replace(': isPastFinalized ? (', ': ' + beforeContractPanel + 'isPastFinalized ? (')
);

fs.writeFileSync(path, c);
console.log('TodayTasks.tsx updated successfully.');
