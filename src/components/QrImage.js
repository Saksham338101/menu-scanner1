import { useEffect, useState } from 'react'
import Image from 'next/image'
import { generateQrDataUrl } from '../utils/qr'

export default function QrImage({ data, size = '150x150', alt = 'QR Code', className = '', onReady }) {
  const [src, setSrc] = useState('')
  const [dimensions, setDimensions] = useState({ width: 150, height: 150 })

  useEffect(() => {
    if (!data) {
      setSrc('')
      return
    }

    let active = true

    const [width, height] = String(size)
      .split('x')
      .map((value) => Number.parseInt(value, 10))
    const resolvedWidth = Number.isFinite(width) ? width : 150
    const resolvedHeight = Number.isFinite(height) ? height : resolvedWidth
    setDimensions({ width: resolvedWidth, height: resolvedHeight })

    generateQrDataUrl(data, { size })
      .then((url) => {
        if (!active) return
        setSrc(url)
        if (onReady) onReady(url)
      })
      .catch((error) => {
        console.error('[QrImage] Failed to generate QR code', error)
        if (active) {
          setSrc('')
        }
      })

    return () => {
      active = false
    }
  }, [data, size, onReady])

  if (!data || !src) return null

  return (
    <Image
      src={src}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      className={className}
    />
  )
}
