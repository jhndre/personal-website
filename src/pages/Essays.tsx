import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../Footer'

export default function Essays() {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const n = 3
    let i = 0
    const id = setInterval(() => {
      i = (i + 1) % (n + 1)
      setDots('.'.repeat(i))
    }, 400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-[42rem] mx-auto px-6 py-16 w-full font-mono font-medium text-[12px]">
        <Link
          to="/"
          className="text-[#f5f5f0] text-sm border-b border-dashed border-[#444] hover:border-[#c4a8ff] hover:text-[#af87ff] transition-colors inline-block mb-12"
        >
          ← back
        </Link>
        <h1 className="text-[12px] font-bold tracking-tight text-[#f5f5f0] font-['IBM_Plex_Mono']">
          v0.1 loading<span className="inline-block min-w-[1ch]">{dots}</span>
        </h1>
      </div>
      <Footer />
    </div>
  )
}
