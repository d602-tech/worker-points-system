import { useGasAuthContext } from "@/lib/useGasAuth";
import { isGasConfigured } from "@/lib/gasApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { ArrowRight, Shield, Smartphone, BarChart3, Cloud, LogIn, AlertCircle, Lock, Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const FEATURES = [
  { icon: Smartphone, title: "手機優先設計", desc: "協助員在工地現場用手機，1 分鐘完成每日填報與佐證上傳" },
  { icon: BarChart3, title: "完整報表系統", desc: "差勤統計、工作月報、服務費統計，一鍵匯出 Excel 或列印" },
  { icon: Shield, title: "四階段審核流程", desc: "草稿 → 送出 → 初審 → 廠商確認，全程留痕可追溯" },
  { icon: Cloud, title: "Google 雲端整合", desc: "資料存儲於 Google Sheets，佐證檔案上傳至 Google Drive" },
];

type LoginTab = "google" | "password";

export default function LandingPage() {
  const { isAuthenticated, user, loginWithGoogle, loginWithPassword, loading, error } = useGasAuthContext();
  const [, navigate] = useLocation();
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState<LoginTab>("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const gasConfigured = isGasConfigured();

  // ── Google Identity Services 初始化 ──────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !showLogin || activeTab !== "google") return;

    const initGsi = () => {
      const google = (window as unknown as { google?: { accounts: { id: { initialize: (opts: object) => void; renderButton: (el: HTMLElement, opts: object) => void } } } }).google;
      if (!google?.accounts?.id) return;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          const ok = await loginWithGoogle(response.credential);
          if (ok) {
            toast.success("Google 登入成功");
            setShowLogin(false);
            const stored = JSON.parse(localStorage.getItem("gas_user") || "{}");
            navigate(stored.role === "worker" ? "/worker/today" : "/admin/users");
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (googleBtnRef.current) {
        google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          shape: "rectangular",
          theme: "outline",
          text: "signin_with",
          size: "large",
          width: 340,
          locale: "zh-TW",
        });
      }
    };

    // 若 SDK 尚未載入則動態插入 script
    if (!(window as unknown as { google?: unknown }).google) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGsi;
      document.head.appendChild(script);
    } else {
      initGsi();
    }
  }, [showLogin, activeTab, loginWithGoogle, navigate]);

  // ── 帳號密碼登入 ─────────────────────────────────────────
  const handlePasswordLogin = async () => {
    if (!email.trim()) { toast.error("請輸入 Email"); return; }
    if (!password) { toast.error("請輸入密碼"); return; }
    if (!gasConfigured) { toast.error("系統尚未設定 GAS URL，請聯絡管理員"); return; }
    const ok = await loginWithPassword(email.trim(), password);
    if (ok) {
      toast.success("登入成功");
      setShowLogin(false);
      setEmail(""); setPassword("");
      const stored = JSON.parse(localStorage.getItem("gas_user") || "{}");
      navigate(stored.role === "worker" ? "/worker/today" : "/admin/users");
    }
  };

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
                  <Link href={user?.role === "worker" ? "/worker/today" : "/admin/users"}>
                    進入系統 <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <Button size="sm" className="bg-blue-700 hover:bg-blue-800 gap-1.5" onClick={() => setShowLogin(true)}>
                <LogIn className="w-4 h-4" /> 登入
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
            <Button size="lg" className="bg-blue-700 hover:bg-blue-800 gap-2 shadow-elegant-md" onClick={() => setShowLogin(true)}>
              立即登入使用 <ArrowRight className="w-5 h-5" />
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
            <div
              className="group p-6 rounded-2xl border-2 border-blue-100 hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 cursor-pointer"
              onClick={() => isAuthenticated ? navigate("/worker/today") : setShowLogin(true)}
            >
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
            <div
              className="group p-6 rounded-2xl border-2 border-slate-100 hover:border-slate-400 hover:bg-slate-50/50 transition-all duration-200 cursor-pointer"
              onClick={() => isAuthenticated ? navigate("/admin/users") : setShowLogin(true)}
            >
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
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        115年度協助員點數管理系統 © 2026 綜合施工處 ｜ 資料存儲於 Google Workspace
      </footer>

      {/* ── 登入 Dialog ─────────────────────────────────── */}
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">點</span>
              </div>
              登入系統
            </DialogTitle>
            <DialogDescription>
              請選擇登入方式。帳號由管理員在人員名冊中設定。
            </DialogDescription>
          </DialogHeader>

          {/* 警告訊息 */}
          {!gasConfigured && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>系統尚未完成設定。請先至「系統設定」頁面輸入 GAS Web App URL。</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 分頁切換 */}
          <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
            <button
              id="login-tab-google"
              onClick={() => setActiveTab("google")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all",
                activeTab === "google"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Google G 圖示 */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google 帳號
            </button>
            <button
              id="login-tab-password"
              onClick={() => setActiveTab("password")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all",
                activeTab === "password"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Lock className="w-4 h-4" />
              帳號密碼
            </button>
          </div>

          {/* Google 登入 */}
          {activeTab === "google" && (
            <div className="flex flex-col items-center gap-4 py-2">
              {GOOGLE_CLIENT_ID ? (
                <>
                  <p className="text-sm text-muted-foreground text-center">
                    使用您的 Google 帳號登入，系統將自動比對人員名冊中的 Email。
                  </p>
                  {/* GSI 渲染目標 */}
                  <div ref={googleBtnRef} className="flex justify-center" />
                  {loading && (
                    <p className="text-sm text-muted-foreground animate-pulse">驗證中，請稍候⋯</p>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Google 登入尚未設定（缺少 VITE_GOOGLE_CLIENT_ID），請改用帳號密碼登入。</span>
                </div>
              )}
            </div>
          )}

          {/* 帳號密碼登入 */}
          {activeTab === "password" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="例：worker@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handlePasswordLogin()}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">密碼</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPwd ? "text" : "password"}
                    placeholder="請輸入密碼"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePasswordLogin()}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                id="login-submit"
                className="w-full bg-blue-700 hover:bg-blue-800"
                onClick={handlePasswordLogin}
                disabled={loading || !gasConfigured}
              >
                {loading ? "驗證中..." : "登入"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                密碼由管理員設定，如有問題請聯絡工安組。
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
