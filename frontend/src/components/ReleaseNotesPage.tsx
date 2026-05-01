import { BookOpen, CalendarDays, CheckCircle2, MessageSquare } from "lucide-react"

const RELEASES = [
  {
    version: "2026.05",
    date: "May 1, 2026",
    title: "Learning and translation updates",
    summary: "This release makes Unmute more useful for practice, smoother during translation, and easier to move around.",
    groups: [
      {
        label: "Learning platform",
        Icon: BookOpen,
        items: [
          "Added a searchable sign library so learners can browse and practice signs directly.",
          "Added practice stats, streaks, missed-sign review, and clearer quiz feedback.",
        ],
      },
      {
        label: "Translation improvements",
        Icon: MessageSquare,
        items: [
          "Cleaned up the translate workspace so input, sign sequence, playback, and feedback feel like one flow.",
          "Improved replay behavior so GIFs restart reliably and repeated signs stay in the sequence.",
        ],
      },
      {
        label: "Navigation",
        Icon: CheckCircle2,
        items: [
          "Added direct URLs for Translate, Learn, Release Notes, About, and Admin.",
          "Added this Release Notes page so product updates are easier to follow.",
        ],
      },
    ],
  },
]

export function ReleaseNotesPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary">Release Notes</h1>
      </section>

      <div className="flex flex-col gap-4">
        {RELEASES.map((release) => (
          <article key={release.version} className="rounded-[16px] border border-border-soft bg-bg-card p-5 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {release.date}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-text-primary">{release.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{release.summary}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {release.groups.map(({ label, Icon, items }) => (
                <section key={label} className="rounded-[12px] border border-border-soft bg-bg-input p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <Icon className="h-4 w-4 text-accent-terracotta" />
                    {label}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {items.map((item) => (
                      <li key={item} className="text-sm leading-relaxed text-text-secondary">
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
