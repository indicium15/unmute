import type { NavMode } from "@/components/AppNavbar"

interface FooterProps {
  onNavigate: (dest: NavMode | "home") => void
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-[#f9fafb] border-t border-gray-100 mt-8">
      <div className="max-w-[900px] mx-auto px-6 pt-10 pb-6">
        <div className="grid grid-cols-3 gap-12 mb-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] bg-[#6176f7] flex items-center justify-center flex-shrink-0">
                <img src="/home/icon-logo-footer.svg" alt="" className="w-4 h-4" />
              </div>
              <span className="text-[16px] font-semibold text-[#1e2939]">Kinnect</span>
            </div>
            <p className="text-[14px] leading-[22.75px] text-[#6a7282]">
              Empowering communication through Singapore Sign Language making SgSL accessible to everyone.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[14px] font-semibold text-[#364153]">Explore</p>
            <ul className="flex flex-col gap-2">
              <li>
                <button
                  onClick={() => onNavigate("home")}
                  className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("dictionary")}
                  className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors"
                >
                  SgSL Dictionary
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("learn")}
                  className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors"
                >
                  Learn SgSL
                </button>
              </li>
              <li>
                <a
                  href="https://blogs.ntu.edu.sg/sgslsignbank/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors"
                >
                  SgSL Signbank
                </a>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[14px] font-semibold text-[#364153]">About</p>
            <p className="text-[14px] leading-5 text-[#6a7282]">
              Singapore Sign Language (SgSL) is the natural language used by the Deaf community in Singapore.
            </p>
          </div>
        </div>
        <div className="border-t border-[#e5e7eb] pt-6 flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
          <p className="text-[12px] text-[#99a1af]">© 2026 Kinnect. All rights reserved.</p>
          <a
            href="https://better.sg/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[12px] text-[#99a1af] hover:text-[#6176f7] transition-colors"
          >
            Supported by
            <span className="inline-flex items-center bg-[#111827] rounded-md px-2 py-1">
              <img
                src="https://better.sg/assets/images/logos/better-sg-logo-white.png"
                alt="better.sg"
                className="h-4 w-auto"
              />
            </span>
          </a>
          <p className="text-[12px] text-[#99a1af] flex items-center gap-1">
            Made with
            <img src="/home/icon-heart.svg" alt="love" className="w-3 h-3" />
            for the Deaf community in Singapore
          </p>
        </div>
      </div>
    </footer>
  )
}
