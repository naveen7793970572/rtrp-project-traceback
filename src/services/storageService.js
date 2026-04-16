import imageCompression from 'browser-image-compression'

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const OPTIONS = {
    maxSizeMB: 0.2,           // was 0.5 — smaller file = faster upload
    maxWidthOrHeight: 600,    // was 800 — sufficient for item thumbnails
    useWebWorker: true,
    initialQuality: 0.8,
}

export async function uploadImage(file) {
    const compressed = await imageCompression(file, OPTIONS)
    const formData = new FormData()
    formData.append('file', compressed)
    formData.append('upload_preset', UPLOAD_PRESET)

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
    })

    if (!res.ok) throw new Error('Image upload failed.')
    const data = await res.json()
    return data.secure_url
}
