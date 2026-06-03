import { useState } from "react"
import { LogOut, LogIn, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false"

export type NavMode = "home" | "translate" | "learn" | "dictionary" | "admin"

interface AppNavbarProps {
  activeMode: NavMode
  onNavigate: (mode: NavMode) => void
  onLogout: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
}

export function AppNavbar({ activeMode, onNavigate, onLogout, isAdmin, isLoggedIn = true }: AppNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleAuthClick = () => {
    console.debug("[Navbar][auth-click]", {
      activeMode,
      isLoggedIn,
      pathname: window.location.pathname,
      action: isLoggedIn ? "logout" : "login",
    })
    onLogout()
  }

  const navItems = [
    { mode: "home" as NavMode, label: "Home" },
    { mode: "translate" as NavMode, label: "Translate" },
    { mode: "dictionary" as NavMode, label: "Dictionary" },
    { mode: "learn" as NavMode, label: "Learn SgSL" },
    ...(isAdmin ? [{ mode: "admin" as NavMode, label: "Admin" }] : []),
  ] as { mode: NavMode; label: string }[]

  const handleNavClick = (mode: NavMode) => {
    onNavigate(mode)
    setMobileOpen(false)
  }

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        <button
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2.5 flex-shrink-0"
        >
          <div className="w-9 h-9 rounded-[14px] bg-[#6176f7] shadow flex items-center justify-center flex-shrink-0">
            <img src="/home/icon-logo.svg" alt="" className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-[14px] font-bold leading-5 text-[#6176f7]">Kinnect</p>
            <p className="text-[11px] font-normal leading-4 text-[#6a7282] hidden sm:block">Singapore Sign Language</p>
          </div>
        </button>

        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => handleNavClick(mode)}
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

        <div className="flex items-center gap-2">
          {AUTH_ENABLED && (
            <button
              onClick={handleAuthClick}
              title={isLoggedIn ? "Sign out" : "Sign in"}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#6a7282] hover:text-[#4a5565] hover:bg-gray-100 transition-all duration-200 flex-shrink-0"
            >
              {isLoggedIn ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#6a7282] hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
          {navItems.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => handleNavClick(mode)}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors",
                activeMode === mode
                  ? "bg-[#6176f7] text-white"
                  : "text-[#6a7282] hover:text-[#101828] hover:bg-gray-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
