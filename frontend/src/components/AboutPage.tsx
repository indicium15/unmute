import { Github, Hand, Brain, Globe, GraduationCap, ShieldCheck } from "lucide-react"

const GITHUB_URL = "https://github.com/indicium15/unmute"

const FEATURES = [
  {
    Icon: Brain,
    title: "AI-Powered Translation",
    desc: "Gemini AI converts text and speech into a Singapore Sign Language sign sequence, handling multiple input languages automatically.",
  },
  {
    Icon: Hand,
    title: "Reference GIF Playback",
    desc: "Each sign maps to a reference GIF so learners can inspect real examples while reviewing the sequence.",
  },
  {
    Icon: GraduationCap,
    title: "Interactive Learning",
    desc: "Quiz mode lets you test your SgSL vocabulary by identifying signs from animated GIFs — one question at a time.",
  },
  {
    Icon: Globe,
    title: "Multilingual Input",
    desc: "Type or speak in English, Mandarin, Malay, or Tamil. The pipeline detects your language and translates it into a SgSL sign sequence.",
  },
]

const STACK = [
  { label: "Frontend", items: ["React 19", "TypeScript", "Tailwind CSS v4"] },
  { label: "Backend",  items: ["FastAPI", "Python 3.11", "Google Gemini AI", "Firebase"] },
  { label: "Storage",  items: ["Google Cloud Storage", "Firestore", "MediaPipe landmarks"] },
]

export function AboutPage() {
  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 animate-fade-in-up">
      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-text-muted">
            About Unmute
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-text-primary">
            A practical bridge from text and speech to Singapore Sign Language.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-text-secondary max-w-2xl leading-relaxed">
            Unmute turns written or spoken input into a SgSL sign sequence, then renders the result through reference GIF playback.
          </p>
        </div>
        <p className="rounded-[14px] border border-border-soft bg-bg-card p-4 text-sm leading-relaxed text-text-secondary">
          The goal is not to replace fluent human signing. It is to make SgSL easier to access, practice, and prototype with while keeping the translation path visible.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] bg-bg-input border border-border-warm text-text-secondary text-sm font-medium hover:border-accent-terracotta hover:text-accent-terracotta transition-all duration-200"
        >
          <Github className="w-4 h-4" />
          View on GitHub
        </a>
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] bg-bg-input border border-border-warm text-text-secondary text-sm font-medium">
          <ShieldCheck className="w-4 h-4 text-accent-terracotta" />
          Built for authenticated use
        </span>
      </div>

      <div className="divider" />

      <div>
        <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-text-muted mb-5">
          How it works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="flex flex-col gap-3 p-5 rounded-[14px] bg-bg-card border border-border-soft hover:border-border-warm transition-all duration-200"
              style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.3)" }}
            >
              <div className="w-9 h-9 rounded-[10px] bg-accent-soft border border-accent-terracotta/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4.5 h-4.5 text-accent-terracotta" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="divider" />

      <div>
        <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-text-muted mb-5">
          Tech stack
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STACK.map(({ label, items }) => (
            <div key={label} className="flex flex-col gap-3 p-5 rounded-[14px] bg-bg-card border border-border-soft">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">{label}</p>
              <ul className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="w-1 h-1 rounded-full bg-accent-terracotta flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="divider" />
      <p className="text-center text-xs text-text-muted pb-4">
        Built for Singapore, with visible translation steps so learners and reviewers can inspect what happened.
      </p>
    </div>
  )
}
