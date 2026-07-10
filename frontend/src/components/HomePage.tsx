import { useState } from "react"
// TODO: re-enable once we have access to a working transcription model on Azure OpenAI.
// import { useVoiceRecording } from "@/hooks/useVoiceRecording"
import type { TranslationResult } from "@/hooks/useTranslation"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { Footer } from "@/components/Footer"

interface HomePageProps {
  onNavigate: (mode: NavMode) => void
  onSignIn?: () => void
  onTranslate?: (text: string) => void
  onVoiceResult?: (result: TranslationResult) => void
  onLogout?: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
}

const SUGGESTED_PHRASES = [
  "I love durian, it is delicious",
  "Take the MRT to Orchard Road for shopping",
  "Let's eat chicken rice for lunch",
  "I am hungry, want to go for supper tonight?",
]

export function HomePage({ onNavigate, onTranslate, onLogout, isAdmin, isLoggedIn = true }: HomePageProps) {
  const [inputText, setInputText] = useState("")

  // TODO: re-enable once we have access to a working transcription model on Azure OpenAI.
  // const { isRecording, isProcessing, toggleRecording } = useVoiceRecording({
  //   onTranscription: (text) => setInputText(text),
  //   onResult: (result) => onVoiceResult?.(result),
  // })

  const handleTranslate = () => {
    const text = inputText.trim()
    if (!text) return
    onTranslate?.(text)
  }

  const handlePhrase = (phrase: string) => {
    onTranslate?.(phrase)
  }

  return (
    <div className="min-h-screen bg-white font-sans" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <AppNavbar
        activeMode="home"
        onNavigate={onNavigate}
        onLogout={onLogout ?? (() => {})}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
      />

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

        <div className="relative max-w-[1152px] mx-auto px-6 py-10 sm:py-[60px] flex flex-col items-center gap-7">
          {/* Heading */}
          <h1 className="text-4xl sm:text-[60px] font-bold leading-tight sm:leading-[75px] text-[#101828] text-center">
            Learn <span className="text-[#6176f7]">SgSL</span> with ease
          </h1>

          {/* Subtitle */}
          <p className="text-[18px] font-normal leading-[29px] text-[#6a7282] text-center max-w-[576px]">
            Translate any phrase to Singapore Sign Language. Explore the SgSL dictionary, or start your learning journey today.
          </p>


          {/* Search Input */}
          <div className="w-full max-w-[672px] bg-white border border-gray-100 rounded-2xl shadow-lg flex items-center overflow-hidden h-14">
            <div className="pl-5 pr-3 flex items-center flex-shrink-0">
              <img src="/home/icon-search.svg" alt="" className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleTranslate() }}
              placeholder="Type a word or phrase (e.g. Hello my name is...)"
              className="flex-1 text-[16px] text-[#6a7282] placeholder:text-[#99a1af] outline-none bg-transparent min-w-0"
            />
            <div className="pr-2 flex-shrink-0 flex items-center gap-1">
              {/* TODO: re-enable voice input once we have access to a working transcription model on Azure OpenAI.
              <button
                onClick={toggleRecording}
                title={isRecording ? "Stop recording" : "Record voice"}
                className={`w-10 h-10 rounded-[12px] flex items-center justify-center transition-all ${
                  isRecording
                    ? "bg-red-50 text-red-500 animate-pulse"
                    : isProcessing
                    ? "bg-gray-50 text-[#99a1af] cursor-wait"
                    : "text-[#99a1af] hover:bg-gray-50 hover:text-[#6176f7]"
                }`}
              >
                {isProcessing ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="11" rx="3" />
                    <path d="M5 10a7 7 0 0014 0" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="9" y1="22" x2="15" y2="22" />
                  </svg>
                )}
              </button>
              */}
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
        <div className="max-w-[1152px] mx-auto px-6 py-10 sm:py-0 sm:h-[416px] flex flex-col sm:flex-row items-center gap-8 sm:gap-12">
          <div className="flex flex-col gap-5 sm:max-w-[468px]">
            <h2 className="text-2xl sm:text-[30px] font-bold leading-tight sm:leading-[37.5px] text-white">
              Bridging communication gaps in Singapore
            </h2>
            <p className="text-[14px] font-normal leading-[22.75px] text-white/80">
              SgSL (Singapore Sign Language) is the primary language of the Deaf community in Singapore. Our platform helps both Deaf and hearing individuals communicate effectively.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate("dictionary")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-white text-[#6176f7] text-[14px] font-semibold hover:bg-gray-50 transition-colors"
              >
                View SgSL Dictionary
                <img src="/home/icon-arrow-right.svg" alt="" className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate("learn")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-white text-[#6176f7] text-[14px] font-semibold hover:bg-gray-50 transition-colors"
              >
                Learn SgSL
                <img src="/home/icon-arrow-right2.svg" alt="" className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center sm:h-full overflow-hidden">
            <img
              src="/home/people-signing.png"
              alt="Two people communicating in sign language"
              className="h-48 sm:h-[386px] object-contain object-center"
              style={{ maxWidth: "353px", objectPosition: "center" }}
            />
          </div>
        </div>
      </section>

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
