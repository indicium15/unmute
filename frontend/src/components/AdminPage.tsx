import { useState } from "react"
import { Users, FileText, ShieldCheck, BarChart2, Coins } from "lucide-react"
import { DashboardPanel } from "@/components/admin/DashboardPanel"
import { UsagePanel } from "@/components/admin/UsagePanel"
import { UsersPanel } from "@/components/admin/UsersPanel"
import { AdminsPanel } from "@/components/admin/AdminsPanel"
import { LogsPanel } from "@/components/admin/LogsPanel"
import type { AdminTab } from "@/components/admin/types"

const TOP_TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <BarChart2 className="w-4 h-4" /> },
  { id: "usage", label: "Token Usage", icon: <Coins className="w-4 h-4" /> },
  { id: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
  { id: "admins", label: "Admin Access", icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "logs", label: "Activity Logs", icon: <FileText className="w-4 h-4" /> },
]

export function AdminPage() {
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard")

  return (
    <div className="w-full animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
      {/* Top-level admin tab switcher */}
      <div className="inline-flex gap-1.5 p-1.5 bg-[var(--color-bg-cream)] rounded-[20px] border border-[var(--color-border-soft)] mb-8">
        {TOP_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setAdminTab(id)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
              adminTab === id
                ? "bg-[var(--color-bg-card)] text-[var(--color-accent-terracotta)] shadow-[var(--shadow-soft)]"
                : "text-text-secondary hover:text-text-primary hover:bg-white/50"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {adminTab === "dashboard" && <DashboardPanel />}
      {adminTab === "usage" && <UsagePanel />}
      {adminTab === "users" && <UsersPanel />}
      {adminTab === "admins" && <AdminsPanel />}
      {adminTab === "logs" && <LogsPanel />}
    </div>
  )
}
