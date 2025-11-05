import QRCode from 'qrcode'

function resolveSize(size) {
  if (!size) return { width: 256, height: 256 }
  if (typeof size === 'number') return { width: size, height: size }
  if (typeof size === 'string') {
    const [w, h] = size.split('x').map((value) => Number.parseInt(value, 10)).filter(Number.isFinite)
    if (w && h) return { width: w, height: h }
    if (w) return { width: w, height: w }
  }
  return { width: 256, height: 256 }
}

export async function generateQrDataUrl(data, { size = '256x256', margin = 1 } = {}) {
  if (!data) return ''
  const { width } = resolveSize(size)
  try {
    return await QRCode.toDataURL(String(data), {
      width,
      margin,
      errorCorrectionLevel: 'H'
    })
  } catch (error) {
    console.error('[qr] Failed to generate QR data URL', error)
    return ''
  }
}
