import { Link, useLocation } from "wouter";
import { ClipboardList, Calendar, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/worker/today",    icon: ClipboardList, label: "今日任務" },
  { path: "/worker/calendar", icon: Calendar,      label: "日曆總覽" },
  { path: "/worker/monthly",  icon: BarChart3,     label: "月報填報" },
  { path: "/worker/profile",  icon: User,          label: "我的"     },
];

interface WorkerLayoutProps {
  children: React.ReactNode;
}

export default function WorkerLayout({ children }: WorkerLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-[430px] mx-auto relative">
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-[72px]">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50
                      bg-white/95 backdrop-blur-md border-t border-border
                      pb-safe shadow-elegant">
        <div className="flex items-stretch h-[60px]">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const isActive = location === path || (path === "/worker/today" && location === "/worker");
            return (
              <Link key={path} href={path} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center justify-center h-full gap-0.5 transition-all duration-200",
                  "touch-action-manipulation select-none",
                  isActive
                    ? "text-blue-700"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                  <div className={cn(
                    "relative flex items-center justify-center w-10 h-6 rounded-full transition-all duration-200",
                    isActive && "bg-blue-50"
                  )}>
                    <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                    {/* Active indicator dot */}
                    {isActive && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-700" />
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium leading-none",
                    isActive ? "text-blue-700" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
