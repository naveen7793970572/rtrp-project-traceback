import { useState, useRef, useEffect } from 'react'
import { collection, addDoc, serverTimestamp, Timestamp, doc, updateDoc, increment } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { uploadImage } from '../services/storageService'
import { loadModel, extractEmbedding } from '../services/matchingService'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

const CATEGORIES = ['Electronics', 'ID / Cards', 'Bags', 'Clothing', 'Books', 'Keys', 'Jewellery', 'Sports', 'Other']
const LOCATIONS = ['Library', 'Canteen', 'Hostel', 'Main Block', 'Labs', 'Auditorium', 'Sports Ground', 'Parking', 'Other']

export default function ReportItemPage() {
    const { currentUser } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const imgRef = useRef(null)

    const [type, setType] = useState(searchParams.get('type') === 'found' ? 'found' : 'lost')
    const [form, setForm] = useState({ title: '', category: CATEGORIES[0], description: '', location: LOCATIONS[0], date: '' })
    const [imageFile, setImageFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [loading, setLoading] = useState(false)

    // Pre-computed embedding stored here so submit doesn't have to wait for it
    const embeddingRef = useRef([])
    const embeddingReadyRef = useRef(false)

    // ── Pre-warm MobileNet as soon as the page mounts ────────────────────────
    // This runs in the background so the model is already loaded by the time
    // the user clicks Submit, saving 3-8 seconds on submit.
    useEffect(() => {
        loadModel().catch(() => {}) // silently warm up — never block the UI
    }, [])

    const update = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

    async function handleFileChange(e) {
        const file = e.target.files[0]
        if (!file) return
        setImageFile(file)
        embeddingReadyRef.current = false
        embeddingRef.current = []

        const url = URL.createObjectURL(file)
        setPreview(url)

        // Start embedding extraction immediately in the background while user
        // fills in the rest of the form — by the time they hit Submit it's done.
        const img = new Image()
        img.src = url
        img.onload = async () => {
            // AI category suggestion (found items only)
            if (type === 'found') {
                try {
                    toast.loading('Analyzing image…', { id: 'ai-vision' })
                    const model = await loadModel() // already warm from useEffect
                    const predictions = await model.classify(img)
                    if (predictions?.length > 0) {
                        const topMatch = predictions[0].className.toLowerCase()
                        let exactCat = 'Other'
                        if (topMatch.includes('computer') || topMatch.includes('phone') || topMatch.includes('keyboard') || topMatch.includes('charger') || topMatch.includes('cable') || topMatch.includes('adapter')) exactCat = 'Electronics'
                        else if (topMatch.includes('bag') || topMatch.includes('backpack') || topMatch.includes('purse')) exactCat = 'Bags'
                        else if (topMatch.includes('book') || topMatch.includes('paper') || topMatch.includes('notebook')) exactCat = 'Books'
                        else if (topMatch.includes('shirt') || topMatch.includes('suit') || topMatch.includes('clothing') || topMatch.includes('shoe')) exactCat = 'Clothing'
                        else if (topMatch.includes('key')) exactCat = 'Keys'
                        else if (topMatch.includes('ring') || topMatch.includes('necklace') || topMatch.includes('watch') || topMatch.includes('bracelet')) exactCat = 'Jewellery'
                        else if (topMatch.includes('ball') || topMatch.includes('racket') || topMatch.includes('sport')) exactCat = 'Sports'
                        else if (topMatch.includes('wallet') || topMatch.includes('id') || topMatch.includes('card')) exactCat = 'ID / Cards'

                        setForm(f => ({ ...f, category: exactCat }))
                        toast.success(`Category auto-suggested: ${exactCat}`, { id: 'ai-vision' })
                    } else {
                        toast.dismiss('ai-vision')
                    }
                } catch {
                    toast.dismiss('ai-vision')
                }
            }

            // Extract embedding in background regardless of type
            try {
                embeddingRef.current = await extractEmbedding(img)
                embeddingReadyRef.current = true
            } catch {
                embeddingRef.current = []
                embeddingReadyRef.current = true // mark done even on failure
            }
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.title.trim()) return toast.error('Title is required.')
        setLoading(true)
        try {
            let imageURL = ''
            let embedding = embeddingRef.current ?? []

            if (imageFile) {
                // If embedding is still computing (user submitted very fast),
                // wait for it — but cap the wait so it never blocks forever.
                if (!embeddingReadyRef.current) {
                    await Promise.race([
                        new Promise(res => {
                            const poll = setInterval(() => {
                                if (embeddingReadyRef.current) { clearInterval(poll); res() }
                            }, 100)
                        }),
                        new Promise(res => setTimeout(res, 5000)) // 5s max wait
                    ])
                    embedding = embeddingRef.current ?? []
                }

                // Upload image to Cloudinary
                imageURL = await uploadImage(imageFile)
            }

            const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))

            const itemData = {
                type,
                title: form.title.trim(),
                category: form.category,
                description: form.description.trim(),
                location: form.location,
                date: form.date,
                imageURL,
                embedding,
                status: type === 'found' ? 'Found' : 'open',
                reportedBy: currentUser.uid,
                reporterName: currentUser.displayName,
                createdAt: serverTimestamp(),
                expiresAt,
            }

            const ref = await addDoc(collection(db, 'items'), itemData)

            // Update user profile counters (non-critical)
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), { itemsReported: increment(1) })
                if (type === 'found') {
                    await updateDoc(doc(db, 'users', currentUser.uid), { karma: increment(10) })
                }
            } catch (profileErr) {
                console.warn('User profile update skipped:', profileErr.code, profileErr.message)
            }

            if (type === 'found') {
                toast.success('+10 karma for reporting a found item! 🌟')
            } else {
                toast.success('Lost item reported!')
            }

            navigate(`/items/${ref.id}`)
        } catch (err) {
            console.error('[ReportItem] Submit failed:', err.code, err.message, err)
            if (err.code === 'permission-denied') {
                toast.error('Permission denied — please update your Firestore security rules.')
            } else if (err.message?.includes('upload')) {
                toast.error('Image upload failed. Try a smaller image or submit without a photo.')
            } else {
                toast.error('Failed to submit. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="page-container narrow">
            <h2>Report an Item</h2>
            <div className="type-toggle">
                <button className={`toggle-btn ${type === 'lost' ? 'active-lost' : ''}`} onClick={() => setType('lost')}>
                    🔍 I Lost Something
                </button>
                <button className={`toggle-btn ${type === 'found' ? 'active-found' : ''}`} onClick={() => setType('found')}>
                    🤲 I Found Something
                </button>
            </div>

            <form onSubmit={handleSubmit} className="report-form glass">
                <div className="form-group">
                    <label>Title *</label>
                    <input name="title" value={form.title} onChange={update} placeholder="e.g. Blue Water Bottle" required />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Category</label>
                        <select name="category" value={form.category} onChange={update}>
                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Location</label>
                        <select name="location" value={form.location} onChange={update}>
                            {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label>Date</label>
                    <input name="date" type="date" value={form.date} onChange={update} max={new Date().toISOString().split('T')[0]} />
                </div>

                <div className="form-group">
                    <label>Description</label>
                    <textarea name="description" value={form.description} onChange={update} rows={3} placeholder="Describe the item in detail…" />
                </div>

                <div className="form-group">
                    <label>Photo {type === 'found' ? '(recommended — helps AI matching)' : '(optional)'}</label>
                    <input type="file" accept="image/*" onChange={handleFileChange} />
                    {preview && (
                        <div className="img-preview">
                            <img ref={imgRef} src={preview} alt="preview" />
                        </div>
                    )}
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                    {loading ? 'Submitting…' : `Submit ${type === 'lost' ? 'Lost' : 'Found'} Report`}
                </button>
            </form>
        </div>
    )
}
