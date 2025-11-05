// MenuImageUpload - upload and preview menu image for a restaurant
import { useState } from 'react'
import Image from 'next/image'

export default function MenuImageUpload({ onChange }) {
  const [preview, setPreview] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const base64 = await convertToBase64(file)
      setPreview(base64)
      onChange?.({ file, base64 })
    } catch (err) {
      console.error('Image processing failed', err)
      alert('Could not read image. Please try another file.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
      {preview && (
        <div className="relative w-full max-w-xs rounded-lg border shadow overflow-hidden">
          <Image
            src={preview}
            alt="Menu preview"
            width={320}
            height={320}
            className="w-full h-auto object-cover"
          />
        </div>
      )}
      {uploading && <div className="text-sm text-gray-500">Processing image…</div>}
    </div>
  )
}

async function convertToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}
