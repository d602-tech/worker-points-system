import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { Button } from "@/components/ui/button";
import {
  Users, CalendarDays, CheckSquare, BarChart2,
  UserCheck, DollarSign, Settings, LogOut, ChevronRight, History,
} from "lucide-react";

const TABS = [
  { id: "users",      path: "/admin/users",       icon: Users,       label: "人員管理"     },
  { id: "attendance", path: "/admin/attendance",   icon: CalendarDays,label: "差勤管理"     },
  { id: "summary",    path: "/reports/summary",    icon: BarChart2,   label: "工作量彙總"   },
  { id: "leave",      path: "/reports/leave",      icon: UserCheck,   label: "出勤暨特休"   },
  { id: "fee",        path: "/reports/fee",        icon: DollarSign,  label: "服務費統計"   },
  { id: "config",     path: "/admin/config",       icon: Settings,    label: "系統設定"     },
  { id: "changelog",  path: "/admin/changelog",    icon: History,     label: "更新歷程"     },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  tab: string;
}

export default function AdminLayout({ children, tab }: AdminLayoutProps) {
  const { user, isAuthenticated, logout } = useGasAuthContext();
  const [, navigate] = useLocation();

  // 未登入 → 提示登入
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-700 flex items-center justify-center mx-auto shadow-elegant-md">
            <span className="text-white text-2xl font-bold">點</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">115年度協助員點數管理系統</h1>
          <p className="text-muted-foreground text-sm">請登入以繼續</p>
          <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => navigate("/")}>
            返回登入頁
          </Button>
        </div>
      </div>
    );
  }

  // 角色權限控管：只有 admin / deptMgr / billing 可進入管理端
  if (user && user.role === "worker") {
    navigate("/worker/today");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border shadow-elegant">
        <div className="flex items-center justify-between px-6 h-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">點</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground leading-none">115年度協助員</div>
              <div className="text-xs text-muted-foreground leading-none mt-0.5">點數管理系統</div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
            <span>管理端</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">
              {TABS.find(t => t.id === tab)?.label || ''}
            </span>
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-medium text-foreground">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <Button
              variant="ghost" size="sm"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">登出</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-stretch overflow-x-auto border-t border-border/50 px-2 scrollbar-hide">
          {TABS.filter(t => {
            // 系統設定與更新歷程僅限 admin
            if ((t.id === "config" || t.id === "changelog") && user?.role !== "admin") return false;
            
            // billing 角色：工作量彙總、出勤暨特休、服務費統計
            if (user?.role === "billing") {
              return ["users", "attendance", "summary", "leave", "fee"].includes(t.id);
            }
            
            // deptMgr 角色：差勤管理、審核中心 (績效評核)、工作量彙總
            if (user?.role === "deptMgr") {
              return ["attendance", "review", "summary"].includes(t.id);
            }

            return true;
          }).map(({ id, path, icon: Icon, label }) => {
            const isActive = tab === id;
            const displayLabel = (user?.role === "deptMgr" && id === "review") ? "績效評核" : label;
            return (
              <Link key={id} href={path}>
                <a className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative border-b-2",
                  isActive 
                    ? "text-blue-700 border-blue-700 bg-blue-50/50" 
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
                )}>
                  <Icon className={cn("w-4 h-4", isActive ? "text-blue-700" : "text-muted-foreground")} />
                  <span className="whitespace-nowrap">{displayLabel}</span>
                </a>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container py-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3 px-6 text-center text-xs text-muted-foreground no-print">
        115年度協助員點數管理系統 © 2026 綜合施工處
      </footer>
    </div>
  );
}
