export default function Footer() {
  return (
    <footer className="pt-8 mt-12 pb-[30px] text-[rgb(135,135,135)] text-xs">
      <div className="max-w-[42rem] mx-auto px-[10px] w-full flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[11px]">Change what's possible</span>
        <span className="flex items-center gap-3 shrink-0 tracking-wider text-[11px]">
          <a href="https://www.linkedin.com/in/drekim" target="_blank" rel="noopener noreferrer" className="border-b border-dashed border-[#444] hover:border-[#c4a8ff] hover:text-[#c4a8ff] transition-colors">in</a>
          <a href="https://x.com/jhandrekim" target="_blank" rel="noopener noreferrer" className="border-b border-dashed border-[#444] hover:border-[#c4a8ff] hover:text-[#c4a8ff] transition-colors">x</a>
        </span>
      </div>
    </footer>
  )
}
