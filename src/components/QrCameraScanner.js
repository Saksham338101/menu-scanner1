// QrCameraScanner - camera-based QR code scanner for Next.js
import { useEffect, useRef } from 'react'

export default function QrCameraScanner({ onScan, onError }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanningRef = useRef(false)

  useEffect(() => {
    let active = true
    let track
    async function startCamera() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        onError && onError('Camera API not available in this browser. Use Chrome/Edge/Firefox on a secure context.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', true)
          await videoRef.current.play()
        }
        scanningRef.current = true
        scanFrame()
      } catch (err) {
        // Provide clearer error messages for common errors
        const name = err && err.name
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          onError && onError('Camera permission denied. Allow camera access in your browser settings.')
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          onError && onError('No suitable camera found. Ensure a camera is connected.')
        } else {
          onError && onError('Camera access denied or not available')
        }
      }
    }
    async function scanFrame() {
      if (!active || !videoRef.current) return
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      // Use a lightweight QR library (jsQR)
      import('jsqr').then(jsQR => {
        const code = jsQR.default(imageData.data, canvas.width, canvas.height)
        if (code && code.data) {
          scanningRef.current = false
          stopCamera()
          onScan && onScan(code.data)
        } else if (scanningRef.current) {
          setTimeout(scanFrame, 300)
        }
      })
    }
    function stopCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
    startCamera()
    return () => {
      active = false
      scanningRef.current = false
      stopCamera()
    }
  }, [onScan, onError])

  return (
    <div className="flex flex-col items-center">
      <video ref={videoRef} className="w-full max-w-xs rounded-lg border mb-2" autoPlay muted playsInline />
      <div className="text-xs text-gray-500">Point your camera at a QR code</div>
    </div>
  )
}
