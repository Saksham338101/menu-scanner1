export const Footer = () => {
    return (
        <footer className="bg-gray-50 border-t border-gray-200">
            <div className="max-w-6xl mx-auto px-6 py-6">
                <div className="text-center space-y-2 text-sm text-gray-500">
                    <div className="font-semibold text-gray-700">meal.it</div>
                    <p>
                        © {new Date().getFullYear()} meal.it. AI-powered menus with health intelligence.
                    </p>
                </div>
            </div>
        </footer>
    )
}
