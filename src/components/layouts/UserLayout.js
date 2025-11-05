import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export function UserLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 bg-gradient-to-br from-orange-50 via-white to-green-50 pb-16">
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default UserLayout
