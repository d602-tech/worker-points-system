import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string | React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "indigo" | "blue" | "red";
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = "確認",
  cancelText = "取消",
  variant = "indigo"
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantClasses = {
    indigo: "bg-indigo-600 hover:bg-indigo-700",
    blue: "bg-blue-600 hover:bg-blue-700",
    red: "bg-red-600 hover:bg-red-700",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 transform animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-50 rounded-full text-slate-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
        </div>
        
        <div className="mb-6">
          {typeof description === "string" ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : (
            description
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button className={`flex-1 ${variantClasses[variant]}`} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
