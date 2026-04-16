import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { findMatches } from '../services/matchingService'
import { awardKarma } from '../services/karmaService'
import { ensureChat, getChatId } from '../services/chatService'
import toast from 'react-hot-toast'

export default function ItemDetailPage() {
    const { id } = useParams()
    const { currentUser } = useAuth()
    const navigate = useNavigate()
    const [item, setItem] = useState(null)
    const [matches, setMatches] = useState([])
    const [loading, setLoading] = useState(true)
    const [claiming, setClaiming] = useState(false)
    const [claimText, setClaimText] = useState('')
    const [existingClaim, setExistingClaim] = useState(null)
    const [pendingClaims, setPendingClaims] = useState([])
    const [activeChatId, setActiveChatId] = useState(null)

    useEffect(() => {
        loadItem()
    }, [id])

    async function loadItem() {
        setLoading(true)
        try {
            const snap = await getDoc(doc(db, 'items', id))
            if (!snap.exists()) {
                toast.error('Item not found')
                navigate('/')
                return
            }
            const data = { id: snap.id, ...snap.data() }
            setItem(data)

            // Load Intelligent Matches (only for open/Found items)
            if (data.status === 'open' || data.status === 'Found') {
                const opposite = data.type === 'lost' ? 'found' : 'lost'
                const targetStatus = opposite === 'found' ? 'Found' : 'open'
                const q = query(collection(db, 'items'), where('type', '==', opposite))
                const mSnap = await getDocs(q)
                let candidates = mSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                candidates = candidates.filter(i => i.status === targetStatus)
                setMatches(findMatches(data, candidates))
            }

            // Check for existing claim by current user
            const myClaimQ = query(collection(db, 'claims'), where('itemId', '==', id), where('claimantId', '==', currentUser.uid))
            const myClaimSnap = await getDocs(myClaimQ)
            if (!myClaimSnap.empty) {
                setExistingClaim({ id: myClaimSnap.docs[0].id, ...myClaimSnap.docs[0].data() })
            }

            // Load pending claims if owner
            if (data.reportedBy === currentUser.uid) {
                const claimsQ = query(collection(db, 'claims'), where('itemId', '==', id), where('status', '==', 'pending'))
                const claimsSnap = await getDocs(claimsQ)
                setPendingClaims(claimsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
            }

            // Compute chatId from approved claim — works for BOTH owner and claimant
            // We look for ANY approved claim for this item, then compute the deterministic chatId
            if (data.status === 'claimed' || data.status === 'returned') {
                try {
                    const approvedQ = query(
                        collection(db, 'claims'),
                        where('itemId', '==', id),
                        where('status', '==', 'approved')
                    )
                    const approvedSnap = await getDocs(approvedQ)
                    if (!approvedSnap.empty) {
                        const approvedClaim = approvedSnap.docs[0].data()
                        const computedChatId = getChatId(id, data.reportedBy, approvedClaim.claimantId)
                        setActiveChatId(computedChatId)
                    }
                } catch (err) {
                    console.warn('Could not compute chatId:', err.message)
                }
            }
        } catch (err) {
            console.error('loadItem error:', err)
        } finally {
            setLoading(false)
        }
    }

    async function submitClaim() {
        if (!claimText.trim()) return toast.error('Please describe why this is yours.')
        setClaiming(true)
        try {
            await addDoc(collection(db, 'claims'), {
                itemId: id,
                claimantId: currentUser.uid,
                claimantName: currentUser.displayName,
                description: claimText.trim(),
                status: 'pending',
                createdAt: serverTimestamp(),
            })
            toast.success('Claim submitted! The item owner will review it.')
            setExistingClaim({ status: 'pending' })
        } catch (err) {
            console.error('submitClaim error:', err)
            toast.error('Failed to submit claim.')
        } finally {
            setClaiming(false)
        }
    }

    async function approveClaim(claim) {
        try {
            // Step 1: Create chat room FIRST using deterministic ID
            const chatId = await ensureChat(id, item.title, item.reportedBy, claim.claimantId)

            // Step 2: Update claim status and stamp chatId
            await updateDoc(doc(db, 'claims', claim.id), {
                status: 'approved',
                chatId,
            })

            // Step 3: Update item status to 'claimed' (NOT 'returned'!)
            await updateDoc(doc(db, 'items', id), { status: 'claimed' })

            // Step 4: Award karma — best effort
            try {
                await awardKarma(item.reportedBy, 5)
                await awardKarma(claim.claimantId, 5)
                toast.success('Claim approved! Chat room opened. +5 karma each 🌟')
            } catch (karmaErr) {
                console.warn('Karma award skipped:', karmaErr.code)
                toast.success('Claim approved! Chat room opened.')
            }

            // Update local state so the chat button appears immediately
            setActiveChatId(chatId)
            setItem(prev => ({ ...prev, status: 'claimed' }))
            setPendingClaims(prev => prev.filter(c => c.id !== claim.id))

            // Navigate to chat
            navigate(`/chat/${chatId}`)
        } catch (err) {
            console.error('[approveClaim] FAILED:', err.code, err.message)
            if (err.code === 'permission-denied') {
                toast.error('Permission denied. Please deploy your Firestore security rules.')
            } else {
                toast.error(`Failed to approve claim: ${err.message}`)
            }
        }
    }

    async function rejectClaim(claim) {
        try {
            await updateDoc(doc(db, 'claims', claim.id), { status: 'rejected' })
            setPendingClaims(prev => prev.filter(c => c.id !== claim.id))
            toast.success('Claim rejected.')
        } catch (err) {
            toast.error('Failed to reject claim.')
        }
    }

    async function markReturned() {
        if (!window.confirm('Mark this item as returned? This will close the chat.')) return
        try {
            await updateDoc(doc(db, 'items', id), { status: 'returned' })
            setItem(prev => ({ ...prev, status: 'returned' }))
            toast.success('Item marked as returned! Chat closed.')
        } catch (err) {
            toast.error('Failed to update status.')
        }
    }

    async function deleteItem() {
        if (!window.confirm('Are you absolutely sure you want to permanently delete this listing?')) return
        try {
            await deleteDoc(doc(db, 'items', id))
            toast.success('Listing safely deleted.')
            navigate('/')
        } catch (err) {
            toast.error('Failed to delete item.')
        }
    }

    if (loading) return <div className="loading-spinner">Loading item…</div>
    if (!item) return null

    const isOwner = item.reportedBy === currentUser.uid
    const canClaim = !isOwner && (item.status === 'open' || item.status === 'Found')
    const isClaimed = item.status === 'claimed'
    const isReturned = item.status === 'returned'

    return (
        <div className="page-container narrow">
            <button className="btn btn-ghost btn-sm back-btn" onClick={() => navigate(-1)}>← Back</button>

            <div className="item-detail glass">
                {item.imageURL && <img src={item.imageURL} alt={item.title} className="detail-img" />}
                <div className="detail-badges">
                    <span className={`type-badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>{item.type}</span>
                    <span className={`status-chip status-${item.status}`}>{item.status}</span>
                </div>
                <h2>{item.title}</h2>
                <div className="detail-meta">
                    <span>📂 {item.category}</span>
                    <span>📍 {item.location}</span>
                    {item.date && <span>📅 {item.date}</span>}
                    <span>👤 {item.reporterName}</span>
                </div>
                <p className="detail-desc">{item.description}</p>

                {/* ── Owner actions ── */}
                {isOwner && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                        {isClaimed && (
                            <>
                                <button className="btn btn-success" onClick={markReturned} style={{ flex: 1 }}>✅ Mark as Returned</button>
                                {activeChatId && (
                                    <button className="btn btn-primary" onClick={() => navigate(`/chat/${activeChatId}`)} style={{ flex: 1 }}>💬 Open Chat</button>
                                )}
                            </>
                        )}
                        {isReturned && activeChatId && (
                            <button className="btn btn-ghost" onClick={() => navigate(`/chat/${activeChatId}`)} style={{ flex: 1 }}>💬 View Chat History</button>
                        )}
                        {!isReturned && (
                            <button className="btn btn-ghost" onClick={deleteItem} style={{ color: '#ef4444', border: '1px solid #fca5a5' }}>
                                🗑️ Delete
                            </button>
                        )}
                    </div>
                )}

                {/* ── Pending claims (owner view) ── */}
                {isOwner && pendingClaims.length > 0 && (
                    <div className="claims-section">
                        <h4>Pending Claims ({pendingClaims.length})</h4>
                        {pendingClaims.map(claim => (
                            <div key={claim.id} className="claim-card glass">
                                <p><strong>{claim.claimantName}</strong>: {claim.description}</p>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <button className="btn btn-primary btn-sm" onClick={() => approveClaim(claim)}>
                                        ✓ Approve & Open Chat
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => rejectClaim(claim)}>
                                        ✕ Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Claim section (for non-owners) ── */}
                {canClaim && !existingClaim && (
                    <div className="claim-section">
                        <h4>{item.type === 'found' ? 'Is this yours?' : 'Did you find this?'}</h4>
                        <textarea
                            value={claimText}
                            onChange={e => setClaimText(e.target.value)}
                            placeholder={item.type === 'found' ? "Describe unique features to prove ownership…" : "Describe where you found it…"}
                            rows={3}
                        />
                        <button className="btn btn-primary w-full" onClick={submitClaim} disabled={claiming}>
                            {claiming ? 'Submitting…' : 'Submit Claim'}
                        </button>
                    </div>
                )}

                {/* ── Existing claim info (for claimant) ── */}
                {existingClaim && (
                    <div className="info-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>Claim status: <strong>{existingClaim.status}</strong></div>
                        {existingClaim.status === 'approved' && activeChatId && (
                            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/chat/${activeChatId}`)}>
                                💬 Go to Chat
                            </button>
                        )}
                    </div>
                )}

                {/* ── Chat access for non-owner on returned items ── */}
                {!isOwner && isReturned && activeChatId && (
                    <div className="info-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>Item returned ✅</div>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/chat/${activeChatId}`)}>
                            💬 View Chat History
                        </button>
                    </div>
                )}
            </div>

            {/* AI Matches — only show for open items */}
            {matches.length > 0 && (
                <div className="matches-section">
                    <h3>🤖 Possible Matches</h3>
                    <p className="matches-note">Based on image similarity. Click to view.</p>
                    <div className="matches-grid">
                        {matches.map(m => (
                            <a key={m.id} href={`/items/${m.id}`} className="match-card glass">
                                {m.imageURL && <img src={m.imageURL} alt={m.title} />}
                                <div className="match-info">
                                    <strong>{m.title}</strong>
                                    <span className="match-score">{Math.round(m.score * 100)}% match</span>
                                    <span>📍 {m.location}</span>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
