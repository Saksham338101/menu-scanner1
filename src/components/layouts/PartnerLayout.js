import { PartnerHeader } from '@/components/navigation/PartnerHeader'

export function PartnerLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PartnerHeader />
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white text-slate-500 text-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>© {new Date().getFullYear()} meal.it partners</span>
          <span className="text-xs">Secure dashboard for managing AI menus.</span>
        </div>
      </footer>
    </div>
  )
}

export default PartnerLayout
