import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { LogOut, User, Building2, MapPin, Calendar, Award, Shield } from "lucide-react";
import { Link } from "wouter";

const MOCK_PROFILE = {
  name: "王小明",
  email: "wang@example.com",
  department: "土木工作隊",
  area: "大潭",
  workerType: "一般工地協助員",
  onboardDate: "2025-01-01",
  pastExpDays: 120,
  role: "協助員",
};

export default function Profile() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-700 flex items-center justify-center mx-auto mb-4 shadow-elegant-md">
          <User className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">請先登入</h2>
        <p className="text-sm text-muted-foreground mb-6">登入後可查看個人資料</p>
        <Button asChild className="bg-blue-700 hover:bg-blue-800">
          <a href={getLoginUrl()}>登入系統</a>
        </Button>
      </div>
    );
  }

  const profile = MOCK_PROFILE;

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 px-4 pt-8 pb-16 relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-elegant">
              <span className="text-white text-2xl font-bold">{(user?.name || profile.name).charAt(0)}</span>
            </div>
            <div>
              <div className="text-white text-xl font-bold">{user?.name || profile.name}</div>
              <div className="text-blue-200 text-sm mt-0.5">{profile.workerType}</div>
              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs">
                <Shield className="w-3 h-3" />{profile.role}
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
            { icon: Building2, label: "部門", value: profile.department },
            { icon: MapPin,     label: "服務區域", value: profile.area },
            { icon: Calendar,  label: "到職日期", value: profile.onboardDate },
            { icon: Award,     label: "小計經驗日數", value: `${profile.pastExpDays} 天` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-medium text-foreground">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Email */}
        <div className="bg-white rounded-2xl shadow-elegant border border-border/50 px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">電子郵件</div>
          <div className="text-sm font-medium text-foreground">{user?.email || profile.email}</div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">快速連結</div>
          </div>
          <Link href="/worker/today">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer">
              <span className="text-sm text-foreground">今日任務</span>
              <span className="text-muted-foreground text-xs">→</span>
            </div>
          </Link>
          <Link href="/worker/calendar">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer">
              <span className="text-sm text-foreground">日曆總覽</span>
              <span className="text-muted-foreground text-xs">→</span>
            </div>
          </Link>
          <Link href="/worker/monthly">
            <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
              <span className="text-sm text-foreground">月報填報</span>
              <span className="text-muted-foreground text-xs">→</span>
            </div>
          </Link>
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 gap-2 rounded-xl"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4" />登出系統
        </Button>
      </div>
    </div>
  );
}
