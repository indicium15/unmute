import { useState } from "react"

interface HomePageProps {
  onNavigate: (mode: "translate" | "learn" | "dictionary") => void
  onSignIn: () => void
}

const SUGGESTED_PHRASES = [
  "Hello my name is",
  "Thank you very much",
  "Where is the school",
  "I love Singapore",
  "Please help me",
  "Good morning everyone",
]

export function HomePage({ onNavigate, onSignIn }: HomePageProps) {
  const [inputText, setInputText] = useState("")

  const handleTranslate = () => {
    onNavigate("translate")
  }

  const handlePhrase = (phrase: string) => {
    setInputText(phrase)
    onNavigate("translate")
  }

  return (
    <div className="min-h-screen bg-white font-sans" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-[1152px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-[14px] bg-[#6176f7] shadow flex items-center justify-center flex-shrink-0">
              <img src="/home/icon-logo.svg" alt="" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold leading-5 text-[#6176f7]">SgSL</p>
              <p className="text-[12px] font-normal leading-4 text-[#6a7282]">Singapore Sign Language</p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1">
            <button
              className="px-4 py-2 rounded-[10px] text-[14px] font-medium text-white bg-[#6176f7] shadow"
            >
              Home
            </button>
            <button
              onClick={() => onNavigate("dictionary")}
              className="px-4 py-2 rounded-[10px] text-[14px] font-normal text-[#4a5565] hover:bg-gray-100 transition-colors"
            >
              Dictionary
            </button>
            <button
              onClick={() => onNavigate("learn")}
              className="px-4 py-2 rounded-[10px] text-[14px] font-normal text-[#4a5565] hover:bg-gray-100 transition-colors"
            >
              Learn SGSL
            </button>
          </div>

          <button
            onClick={onSignIn}
            className="px-4 py-2 rounded-[10px] text-[14px] font-medium text-[#6176f7] border border-[#6176f7] hover:bg-[#6176f7] hover:text-white transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-white overflow-hidden">
        {/* Background illustration */}
        <div className="absolute inset-0 pointer-events-none">
          <img
            src="/home/hero-bg.png"
            alt=""
            className="absolute w-full object-cover object-center opacity-90"
            style={{ top: "-25%", height: "190%" }}
          />
        </div>

        <div className="relative max-w-[1152px] mx-auto px-6 py-[60px] flex flex-col items-center gap-7">
          {/* Heading */}
          <h1 className="text-[60px] font-bold leading-[75px] text-[#101828] text-center whitespace-nowrap">
            Learn <span className="text-[#6176f7]">SgSL</span> with ease
          </h1>

          {/* Subtitle */}
          <p className="text-[18px] font-normal leading-[29px] text-[#6a7282] text-center max-w-[576px]">
            Translate any phrase to Singapore Sign Language. Explore the SGSL dictionary, or start your learning journey today.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTranslate}
              className="flex items-center gap-2 px-4 h-9 rounded-[10px] bg-[#6176f7] text-white text-[14px] font-medium shadow hover:bg-[#5068f0] transition-colors"
            >
              <img src="/home/icon-text.svg" alt="" className="w-4 h-4" />
              Text to SGSL
            </button>
            <button
              onClick={handleTranslate}
              className="flex items-center gap-2 px-4 h-9 rounded-[10px] bg-gray-100 text-[#6a7282] text-[14px] font-medium hover:bg-gray-200 transition-colors"
            >
              <img src="/home/icon-voice.svg" alt="" className="w-4 h-4" />
              Voice to SGSL
            </button>
          </div>

          {/* Search Input */}
          <div className="w-full max-w-[672px] bg-white border border-gray-100 rounded-2xl shadow-lg flex items-center overflow-hidden h-14">
            <div className="pl-5 pr-3 flex items-center flex-shrink-0">
              <img src="/home/icon-search.svg" alt="" className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTranslate()}
              placeholder="Type a word or phrase (e.g. Hello my name is...)"
              className="flex-1 text-[16px] text-[#6a7282] placeholder:text-[#99a1af] outline-none bg-transparent min-w-0"
            />
            <div className="pr-2 flex-shrink-0">
              <button
                onClick={handleTranslate}
                className="px-5 h-10 rounded-[14px] bg-[#6176f7] text-white text-[14px] font-medium opacity-40 hover:opacity-100 transition-opacity"
              >
                Translate
              </button>
            </div>
          </div>

          {/* Suggested Phrases */}
          <div className="w-full max-w-[672px] flex flex-col gap-3">
            <p className="text-[12px] font-medium text-[#99a1af] text-center tracking-[0.3px] uppercase">
              Suggested phrases
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  onClick={() => handlePhrase(phrase)}
                  className="px-4 h-9 rounded-full border border-[rgba(97,118,247,0.19)] bg-[rgba(97,118,247,0.03)] text-[#6176f7] text-[14px] font-medium hover:bg-[rgba(97,118,247,0.08)] transition-colors whitespace-nowrap"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="bg-[#6176f7]">
        <div className="max-w-[1152px] mx-auto px-6 py-0 h-[416px] flex items-center gap-12">
          <div className="flex flex-col gap-5 max-w-[468px]">
            <h2 className="text-[30px] font-bold leading-[37.5px] text-white">
              Bridging communication gaps in Singapore
            </h2>
            <p className="text-[14px] font-normal leading-[22.75px] text-white/80">
              SGSL (Singapore Sign Language) is the primary language of the Deaf community in Singapore. Our platform helps both Deaf and hearing individuals communicate effectively.
            </p>
            <div className="flex items-center gap-5">
              <button
                onClick={() => onNavigate("dictionary")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-white text-[#6176f7] text-[14px] font-semibold hover:bg-gray-50 transition-colors"
              >
                View SGSL Dictionary
                <img src="/home/icon-arrow-right.svg" alt="" className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate("learn")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-white text-[#6176f7] text-[14px] font-semibold hover:bg-gray-50 transition-colors"
              >
                Learn SGSL
                <img src="/home/icon-arrow-right2.svg" alt="" className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center h-full overflow-hidden">
            <img
              src="/home/people-signing.png"
              alt="Two people communicating in sign language"
              className="h-[386px] object-contain object-center"
              style={{ width: "353px", objectPosition: "center" }}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#f9fafb] border-t border-gray-100">
        <div className="max-w-[1152px] mx-auto px-6 pt-10 pb-6">
          <div className="grid grid-cols-3 gap-24 mb-8">
            {/* Brand */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[10px] bg-[#6176f7] flex items-center justify-center flex-shrink-0">
                  <img src="/home/icon-logo-footer.svg" alt="" className="w-4 h-4" />
                </div>
                <span className="text-[16px] font-semibold text-[#1e2939]">SGSL Learn</span>
              </div>
              <p className="text-[14px] font-normal leading-[22.75px] text-[#6a7282]">
                Empowering communication through Singapore Sign Language making SGSL accessible to everyone.
              </p>
            </div>

            {/* Explore */}
            <div className="flex flex-col gap-3">
              <p className="text-[14px] font-semibold text-[#364153]">Explore</p>
              <ul className="flex flex-col gap-2">
                <li>
                  <button onClick={() => {}} className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors">
                    Home
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate("dictionary")} className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors">
                    SGSL Dictionary
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate("learn")} className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors">
                    Learn SGSL
                  </button>
                </li>
              </ul>
            </div>

            {/* About */}
            <div className="flex flex-col gap-3">
              <p className="text-[14px] font-semibold text-[#364153]">About</p>
              <p className="text-[14px] font-normal leading-5 text-[#6a7282]">
                Singapore Sign Language (SGSL) is the natural language used by the Deaf community in Singapore.
              </p>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-[#e5e7eb] pt-6 flex items-center justify-between">
            <p className="text-[12px] text-[#99a1af]">© 2026 SGSL Learn. All rights reserved.</p>
            <p className="text-[12px] text-[#99a1af] flex items-center gap-1">
              Made with
              <img src="/home/icon-heart.svg" alt="love" className="w-3 h-3" />
              for the Deaf community in Singapore
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
