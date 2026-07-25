import type { NavMode } from "@/components/AppNavbar"
import { Footer } from "@/components/Footer"

interface PrivacyPolicyPageProps {
  onNavigate: (dest: NavMode | "home") => void
}

const LAST_UPDATED = "25 July 2026"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[18px] font-semibold text-[#101828]">{title}</h2>
      <div className="flex flex-col gap-3 text-[14px] leading-[22px] text-[#4a5565]">{children}</div>
    </section>
  )
}

export function PrivacyPolicyPage({ onNavigate }: PrivacyPolicyPageProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-[1152px] mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => onNavigate("home")} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-[14px] bg-[#6176f7] shadow flex items-center justify-center flex-shrink-0">
              <img src="/home/icon-logo.svg" alt="" className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-semibold leading-5 text-[#6176f7]">Kinnect</p>
              <p className="text-[12px] font-normal leading-4 text-[#6a7282]">Singapore Sign Language</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate("home")}
            className="px-4 py-2 text-[14px] font-medium text-[#4a5565] rounded-[10px] hover:bg-gray-50 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-[760px] w-full mx-auto px-6 py-12 flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-bold text-[#101828]">Privacy Policy</h1>
          <p className="text-[13px] text-[#6a7282]">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="Overview">
          <p>
            Kinnect translates text and voice input into Singapore Sign Language (SgSL). This
            page explains what information we collect when you use the app, why we collect it,
            who we share it with, and the choices you have. It applies to the Kinnect web app and
            its backend services.
          </p>
        </Section>

        <Section title="Information we collect">
          <p>
            <strong className="text-[#101828]">Account information.</strong> If you create an
            account, we store your email address, a unique account ID issued by Firebase
            Authentication and your account status. If you sign in with Google, we receive the email address
            your Google account provides. Your password is handled entirely by Firebase Authentication.
          </p>
          <p>
            <strong className="text-[#101828]">Learning progress.</strong> If you use the Learn
            SgSL feature while signed in, we store which signs you've viewed, your quiz attempts
            and scores, and lesson completion status, linked to your account so your progress is
            saved across visits.
          </p>
          <p>
            <strong className="text-[#101828]">Translations and transcriptions.</strong> When you
            translate text or voice, we log the input along with the resulting sign sequence, 
            to monitor and improve translation quality. These logs are kept separately from your account and are{" "}
            <strong className="text-[#101828]">not linked to your identity</strong>, even if you
            were signed in when you submitted them.
          </p>
          <p>
            <strong className="text-[#101828]">Voice audio.</strong> If you use voice input, your
            audio is streamed in real time to our speech-to-text provider to generate a text
            transcript and is not saved by Kinnect. Only the resulting text (above) is logged.
          </p>
          <p>
            <strong className="text-[#101828]">Feedback.</strong> If you rate a translation or
            leave a comment, we store that feedback. If you're signed in, it's linked to your
            account (email and account ID) so we can follow up if needed; if you're signed out, it's
            stored without any identifying information.
          </p>
          <p>
            <strong className="text-[#101828]">Technical data.</strong> To prevent abuse, we
            briefly use your IP address to enforce request limits on translation and transcription.
            This is held only in server memory to apply the limit and is never written to a
            database.
          </p>
          <p>
            <strong className="text-[#101828]">Cookies.</strong> We don't use tracking or
            advertising cookies. Firebase Authentication keeps you signed in between visits using
            your browser's local storage.
          </p>
        </Section>

        <Section title="How we use this information">
          <p>
            We use this information to provide and improve the translation and learning features,
            maintain your account and lesson progress, keep the service reliable and free of abuse,
            and respond to feedback you submit. We also track aggregate usage statistics that do not 
            contain the content of what you translated or said.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            We use a small number of service providers to run Kinnect, and only share what each one
            needs to do its job:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong className="text-[#101828]">Firebase / Google Cloud</strong> — account
              authentication and database.
            </li>
            <li>
              <strong className="text-[#101828]">Microsoft Azure OpenAI</strong> — processes the
              text or audio you submit to generate the SgSL translation or transcript. This is 
              governed by Microsoft's own data-handling terms for Azure OpenAI.
            </li>
          </ul>
          <p>We do not sell your data or share it with advertisers.</p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We currently retain account records, lesson progress, and logs for as long as your
            account exists or as needed to operate the service. If you'd like your data deleted,
            contact us using the details below and we'll action your request.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can sign out at any time from the navigation menu. To request access to, or
            deletion of, your personal data, contact us at the email below. Revoking or deleting an
            account removes your login access; anonymous translation/transcription logs, which were
            never linked to your identity, are not affected.
          </p>
        </Section>
      <Footer onNavigate={onNavigate} />
      </main>
    </div>
  )
}
