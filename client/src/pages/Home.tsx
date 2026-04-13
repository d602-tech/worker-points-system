import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <main className="text-center space-y-4">
        <h1 className="text-2xl font-bold">115年度協助員點數管理系統</h1>
        <Button asChild><Link href="/">返回首頁</Link></Button>
      </main>
    </div>
  );
}
