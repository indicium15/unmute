import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export type NavMode = "translate" | "learn" | "dictionary" | "admin"

interface AppNavbarProps {
  activeMode: NavMode
  onNavigate: (mode: NavMode) => void
  onLogout: () => void
  isAdmin?: boolean
}

export function AppNavbar({ activeMode, onNavigate, onLogout, isAdmin }: AppNavbarProps) {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        <button
          onClick={() => onNavigate("translate")}
          className="flex items-center gap-2.5 flex-shrink-0"
        >
          <div className="w-9 h-9 rounded-[14px] bg-[#6176f7] shadow flex items-center justify-center flex-shrink-0">
            <img src="/home/icon-logo.svg" alt="" className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-[14px] font-bold leading-5 text-[#6176f7]">SgSL</p>
            <p className="text-[11px] font-normal leading-4 text-[#6a7282] hidden sm:block">Singapore Sign Language</p>
          </div>
        </button>

        <nav className="hidden sm:flex items-center gap-1">
          {(
            [
              { mode: "translate" as NavMode, label: "Home" },
              { mode: "dictionary" as NavMode, label: "Dictionary" },
              { mode: "learn" as NavMode, label: "Learn SgSL" },
              ...(isAdmin ? [{ mode: "admin" as NavMode, label: "Admin" }] : []),
            ] as { mode: NavMode; label: string }[]
          ).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => onNavigate(mode)}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-xl transition-colors",
                activeMode === mode
                  ? "bg-[#6176f7] text-white"
                  : "text-[#6a7282] hover:text-[#101828]"
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <button
          onClick={onLogout}
          title="Sign out"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#6a7282] hover:text-[#4a5565] hover:bg-gray-100 transition-all duration-200 flex-shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
