import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Shield, Smartphone, BarChart3, Cloud } from "lucide-react";

const FEATURES = [
  { icon: Smartphone, title: "手機優先設計", desc: "協助員在工地現場用手機，1 分鐘完成每日填報與佐證上傳" },
  { icon: BarChart3, title: "完整報表系統", desc: "差勤統計、工作月報、服務費統計，一鍵匯出 Excel 或列印" },
  { icon: Shield, title: "四階段審核流程", desc: "草稿 → 送出 → 初審 → 廠商確認，全程留痕可追溯" },
  { icon: Cloud, title: "Google 雲端整合", desc: "資料存儲於 Google Sheets，佐證檔案上傳至 Google Drive" },
];

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border shadow-elegant">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-700 flex items-center justify-center shadow-elegant">
              <span className="text-white font-bold text-lg">點</span>
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm leading-none">115年度協助員</div>
              <div className="text-xs text-muted-foreground leading-none mt-0.5">點數管理系統</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:block">{user?.name}</span>
                <Button asChild size="sm" className="bg-blue-700 hover:bg-blue-800 gap-1.5">
                  <Link href="/worker/today">進入系統 <ArrowRight className="w-4 h-4" /></Link>
                </Button>
              </>
            ) : (
              <Button asChild size="sm" className="bg-blue-700 hover:bg-blue-800">
                <a href={getLoginUrl()}>登入</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          115年度勤務管理系統 正式上線
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">協助員點數管理系統</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
          整合 Google Sheets 與 Google Drive，提供協助員手機端填報介面與管理端完整報表系統
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAuthenticated ? (
            <>
              <Button asChild size="lg" className="bg-blue-700 hover:bg-blue-800 gap-2 shadow-elegant-md">
                <Link href="/worker/today"><Smartphone className="w-5 h-5" />協助員手機端</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link href="/admin/users"><BarChart3 className="w-5 h-5" />管理端桌面介面</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="lg" className="bg-blue-700 hover:bg-blue-800 gap-2 shadow-elegant-md">
              <a href={getLoginUrl()}>立即登入使用 <ArrowRight className="w-5 h-5" /></a>
            </Button>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="container pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl p-6 shadow-elegant hover:shadow-elegant-md transition-all duration-300 border border-border/50">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-blue-700" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Role selector */}
      <section className="container pb-24">
        <div className="bg-white rounded-3xl p-8 shadow-elegant-md border border-border/50">
          <h2 className="text-xl font-semibold text-foreground text-center mb-6">選擇您的角色</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <Link href={isAuthenticated ? "/worker/today" : getLoginUrl()}>
              <div className="group p-6 rounded-2xl border-2 border-blue-100 hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">協助員</div>
                    <div className="text-sm text-muted-foreground">手機端每日填報</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground ml-auto group-hover:text-blue-700 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
            <Link href={isAuthenticated ? "/admin/users" : getLoginUrl()}>
              <div className="group p-6 rounded-2xl border-2 border-slate-100 hover:border-slate-400 hover:bg-slate-50/50 transition-all duration-200 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">管理員</div>
                    <div className="text-sm text-muted-foreground">桌面端審核與報表</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground ml-auto group-hover:text-slate-700 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        115年度協助員點數管理系統 © 2026 綜合施工處 ｜ 資料存儲於 Google Workspace
      </footer>
    </div>
  );
}
