import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../Footer'

export default function NotFound() {
  useEffect(() => {
    document.title = 'Not found · Andre Kim'
    return () => { document.title = 'Andre Kim' }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-[42rem] mx-auto px-6 py-16 w-full">
        <h1 className="text-xl tracking-tight font-light text-[#f5f5f0] mb-2">Not found</h1>
        <p className="text-[rgb(135,135,135)] text-sm mb-8">
          This page doesn't exist. Head back home.
        </p>
        <Link
          to="/"
          className="text-sm text-[#4d8ef0] border-b border-dashed border-[#444] hover:border-[#c4a8ff] hover:text-[#c4a8ff] transition-colors inline-block"
        >
          ← home
        </Link>
      </div>
      <Footer />
    </div>
  )
}
