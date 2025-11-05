import Link from 'next/link'

const dinerHighlights = [
  {
    title: 'Know before you dine',
    description: 'See menus digitised by GPT-5 Mini with calories, macros, and ingredient notes tailored to your health profile.'
  },
  {
    title: 'Scan and get guidance',
    description: 'Use your camera to scan any meal.it QR and instantly receive personalised ordering advice.'
  },
  {
    title: 'Stay on track',
    description: 'All insights run against the health goals, allergies, and conditions you share with us.'
  }
]

const partnerHighlights = [
  {
    title: 'Digitise in minutes',
    description: 'Upload a photo—GPT-5 Mini reads it and publishes a structured menu with pricing and tags.'
  },
  {
    title: 'Delight health-first guests',
    description: 'Give diners the confidence to order with real-time nutrition and AI guidance.'
  },
  {
    title: 'Share anywhere',
    description: 'Auto-generated QR codes and links keep your menu updated without reprints.'
  }
]

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-20">
        <section className="text-center space-y-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.4em] bg-blue-100 text-blue-600">
            meal.it
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 leading-tight">
            Eat smarter with AI-powered menus that match your health goals.
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Build your health profile, scan any meal.it QR, and receive GPT-5 Mini insights for every restaurant and dish you explore.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/restaurants" className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
              Explore restaurants
            </Link>
            <Link href="/scan" className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-gray-400">
              Scan a QR code
            </Link>
            <Link href="/auth" className="px-5 py-3 rounded-lg border border-blue-200 text-blue-600 font-semibold hover:border-blue-300">
              Sign in
            </Link>
          </div>
        </section>

        <section className="space-y-8">
          <header className="text-center space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.4em] text-gray-400">For diners</span>
            <h2 className="text-3xl font-semibold text-gray-900">Plan meals with confidence</h2>
          </header>
          <div className="grid md:grid-cols-3 gap-6">
            {dinerHighlights.map((card) => (
              <div key={card.title} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
                <h3 className="text-xl font-semibold text-gray-900">{card.title}</h3>
                <p className="text-sm text-gray-600">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-3xl p-10 shadow-md space-y-8">
          <header className="space-y-3 text-center md:text-left">
            <span className="text-xs font-semibold uppercase tracking-[0.4em] text-gray-400">For restaurants</span>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-3xl font-semibold text-gray-900">Digitise your menu without the busywork</h2>
              <Link
                href="/partner-dashboard"
                className="inline-flex items-center px-5 py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black"
              >
                Launch partner dashboard
              </Link>
            </div>
          </header>
          <div className="grid md:grid-cols-3 gap-6">
            {partnerHighlights.map((card) => (
              <div key={card.title} className="border border-gray-100 rounded-2xl p-6 bg-gray-50/60 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
                <p className="text-sm text-gray-600">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-blue-900 text-white rounded-3xl p-10 space-y-6 text-center md:text-left md:flex md:items-center md:justify-between md:space-y-0">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold">Ready to match every meal to your health plan?</h2>
            <p className="text-sm text-blue-100 max-w-xl">
              Create a profile in minutes and start exploring AI-personalised menus across the city.
            </p>
          </div>
          <Link
            href="/auth"
            className="px-5 py-3 rounded-lg bg-white text-blue-900 text-sm font-semibold hover:bg-blue-100"
          >
            Get started
          </Link>
        </section>

        <footer className="text-center text-sm text-gray-500">
          meal.it © {new Date().getFullYear()} · Smart menus for health-conscious diners.
        </footer>
      </div>
    </div>
  )
}
