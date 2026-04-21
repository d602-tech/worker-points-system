import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  className?: string;
}

export function LoadingOverlay({ isLoading, text = "資料載入中...", className }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className={cn(
      "absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm transition-all animate-in fade-in duration-300",
      className
    )}>
      <div className="bg-white/80 p-6 rounded-3xl shadow-xl border border-white/50 flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="text-sm font-bold text-slate-600 tracking-wider">{text}</span>
      </div>
    </div>
  );
}
