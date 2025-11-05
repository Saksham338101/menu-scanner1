import '@/styles/globals.css'
import '@/styles/spinner.css'
import { UserLayout } from '@/components/layouts/UserLayout'
import { AuthProvider } from '@/contexts/AuthContext'
import { PartnerSessionProvider } from '@/contexts/PartnerSessionContext'

export default function App({ Component, pageProps }) {
    const getLayout = Component.getLayout ?? ((page) => <UserLayout>{page}</UserLayout>)

    return (
        <PartnerSessionProvider>
            <AuthProvider>
                {getLayout(<Component {...pageProps} />)}
            </AuthProvider>
        </PartnerSessionProvider>
    )
}
