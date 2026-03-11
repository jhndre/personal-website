import { Link } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import Footer from './Footer'

function App() {
  return (
    <div className="max-w-[42rem] mx-auto px-6 py-16">
      <header className="mb-12">
        <h1 className="text-xl tracking-tight mb-2 font-light text-[#f5f5f0]">Andre Kim</h1>
        <p className="text-[rgb(135,135,135)] text-sm">
          <a href="mailto:jiandrekim@gmail.com" className="text-[rgb(135,135,135)] font-light transition-colors">
            jiandrekim@gmail.com
          </a>
          {' · '}
          <a href="mailto:jiandrekim@gmail.com" className="text-xs text-[#4d8ef0] font-light box-content border-b border-dashed border-[#333] hover:border-[rgba(135,135,135,0.5)] hover:text-[#4d8ef0] transition-colors inline-block">
            say hi ↗
          </a>
        </p>
      </header>

      <section className="mb-10 text-xs">
        <Link
          to="/essays"
          className="text-xs font-medium text-[#4d8ef0] uppercase tracking-widest hover:text-[#c4a8ff] transition-colors border-b border-solid border-[#444] hover:border-[#c4a8ff] pb-0 inline-block"
        >
          Essays
        </Link>
      </section>

      <section className="mb-10">
        <h2 className="text-xs font-medium text-[rgb(74,111,165)] uppercase tracking-widest mb-4">
          <a href="https://www.linkedin.com/in/drekim" target="_blank" rel="noopener noreferrer" className="inline-block text-[#4d8ef0] border-b border-solid border-[#444] pb-[1px] hover:text-[#4d8ef0] hover:border-[#4d8ef0] transition-colors [border-image:none]">Career ↗</a>
        </h2>
        <div className="space-y-4 text-[13px]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px]">
              <p className="text-[#f5f5f0]">
                Growth #1, <a href="https://www.voqo.ai/" target="_blank" rel="noopener noreferrer" className="box-content text-[#f5f5f0] border-b border-dashed border-[#333] hover:border-[rgba(135,135,135,0.5)] hover:text-[#f5f5f0] transition-colors">Voqo AI ↗</a>
              </p>
              <span className="text-[rgb(135,135,135)] text-xs shrink-0 tracking-[-1px]">2024 –</span>
            </div>
            <p className="text-[rgb(135,135,135)] text-[11px]">Building the Agentic Future for Real Estate</p>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px]">
              <p className="text-[#f5f5f0]">
                Co-Founder, <a href="https://www.nextgenventures.com.au/" target="_blank" rel="noopener noreferrer" className="box-content text-[rgb(74,111,165)] border-b border-dashed border-[#333] hover:border-[rgba(135,135,135,0.5)] hover:text-[rgb(74,111,165)] transition-colors">NextGen Ventures ↗</a>
              </p>
              <span className="text-[rgb(135,135,135)] text-xs shrink-0 tracking-[-1px]">2022 – 2024</span>
            </div>
            <p className="text-[rgb(135,135,135)] text-[11px]">Built Australia's First Student-led VC fund</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xs font-medium text-[rgb(74,111,165)] uppercase tracking-widest mb-4">Mantra</h2>
        <ul className="space-y-1 text-[rgb(135,135,135)] text-xs">
          <li>Build remarkable things with remarkable people.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xs font-medium text-[#4d8ef0] uppercase tracking-widest mb-4">Interests</h2>
        <p className="text-[rgb(135,135,135)] text-xs">AI agents, shipping, learning in public.</p>
      </section>

      <section className="mb-10">
        <h2 className="text-xs font-medium text-[rgb(74,111,165)] uppercase tracking-widest mb-4">Life</h2>
        <ul className="space-y-1 text-[rgb(135,135,135)] text-xs">
          <li>building in public</li>
          <li>edit this with your own highlights</li>
        </ul>
      </section>

      <Footer />

      <Analytics />
    </div>
  )
}

export default App
