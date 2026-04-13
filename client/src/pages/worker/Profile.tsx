import { useGasAuthContext } from "@/lib/useGasAuth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, User, Building2, MapPin, Calendar, Award, Shield, Briefcase, Mail } from "lucide-react";

export default function Profile() {
  const { user, isAuthenticated, logout } = useGasAuthContext();
  const [, navigate] = useLocation();

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-700 flex items-center justify-center mx-auto mb-4 shadow-elegant-md">
          <User className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">請先登入</h2>
        <p className="text-sm text-muted-foreground mb-6">登入後可查看個人資料</p>
        <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => navigate("/")}>
          返回登入頁
        </Button>
      </div>
    );
  }

  // 角色對應中文名稱
  const roleLabel = {
    admin: "管理者",
    dept_mgr: "部門管理員",
    billing: "廠商請款人員",
    worker: "協助員",
  }[user.role] || user.accountType || "協助員";

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 px-4 pt-8 pb-16 relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-elegant">
              <span className="text-white text-2xl font-bold">{user.name.charAt(0)}</span>
            </div>
            <div>
              <div className="text-white text-xl font-bold">{user.name}</div>
              <div className="text-blue-200 text-sm mt-0.5">{user.workerType || "協助員"}</div>
              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs">
                <Shield className="w-3 h-3" />{roleLabel}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="px-4 -mt-8 space-y-3 pb-6">
        <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">基本資料</div>
          </div>
          {[
            { icon: Building2, label: "部門", value: user.dept || "—" },
            { icon: MapPin, label: "服務區域", value: user.area || "—" },
            { icon: Briefcase, label: "協助員類型", value: user.workerType || "—" },
            { icon: Mail, label: "電子郵件", value: user.email || "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-medium text-foreground truncate">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 工號 */}
        {user.id && (
          <div className="bg-white rounded-2xl shadow-elegant border border-border/50 px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">工號</div>
            <div className="text-sm font-medium text-foreground font-mono">{user.id}</div>
          </div>
        )}

        {/* Quick links */}
        <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">快速連結</div>
          </div>
          <Link href="/worker/today">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer min-h-[48px]">
              <span className="text-sm text-foreground">今日任務</span>
              <span className="text-muted-foreground text-xs">→</span>
            </div>
          </Link>
          <Link href="/worker/calendar">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer min-h-[48px]">
              <span className="text-sm text-foreground">日曆總覽</span>
              <span className="text-muted-foreground text-xs">→</span>
            </div>
          </Link>
          <Link href="/worker/monthly">
            <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer min-h-[48px]">
              <span className="text-sm text-foreground">月報填報</span>
              <span className="text-muted-foreground text-xs">→</span>
            </div>
          </Link>
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 gap-2 rounded-xl"
          onClick={() => { logout(); navigate("/"); }}
        >
          <LogOut className="w-4 h-4" />登出系統
        </Button>
      </div>
    </div>
  );
}
