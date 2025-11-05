import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function PartnerRedirectPage() {
	const router = useRouter()

	useEffect(() => {
		router.replace('/auth')
	}, [router])

	return null
}
