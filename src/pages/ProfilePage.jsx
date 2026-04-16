import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function ProfilePage() {
    const { currentUser, userProfile, fetchProfile, changeUserPassword } = useAuth()
    const [myItems, setMyItems] = useState([])
    const [myChats, setMyChats] = useState([])
    const [newPassword, setNewPassword] = useState('')
    const [changingPassword, setChangingPassword] = useState(false)
    const [cleaning, setCleaning] = useState(false)

    useEffect(() => {
        if (currentUser) {
            fetchProfile(currentUser.uid)
            loadMyItems()
            loadMyChats()
        }
    }, [currentUser])

    async function loadMyItems() {
        const q = query(collection(db, 'items'), where('reportedBy', '==', currentUser.uid), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        setMyItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }

    async function loadMyChats() {
        const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        setMyChats(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }

    async function handleDeleteItem(itemId, e) {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this item completely?')) return;
        
        try {
            await deleteDoc(doc(db, 'items', itemId))
            setMyItems(prev => prev.filter(i => i.id !== itemId))
            toast.success('Item deleted successfully.')
        } catch (err) {
            toast.error('Failed to delete item.')
        }
    }

    async function handlePasswordChange(e) {
        e.preventDefault()
        if (newPassword.length < 6) return toast.error('Password must be at least 6 characters.')
        setChangingPassword(true)
        try {
            await changeUserPassword(newPassword)
            toast.success('Password updated successfully!')
            setNewPassword('')
        } catch (err) {
            toast.error(err.message || 'Failed to update password. You may need to sign out and sign back in.')
        } finally {
            setChangingPassword(false)
        }
    }

    async function clearAllData() {
        if (!window.confirm('CRITICAL WARNING: This will permanently delete ALL items, claims, and chats on the entire platform. This cannot be undone. Are you absolutely sure?')) return;
        setCleaning(true)
        try {
            const items = await getDocs(collection(db, 'items'))
            const claims = await getDocs(collection(db, 'claims'))
            const chats = await getDocs(collection(db, 'chats'))
            
            const promises = []
            items.docs.forEach(d => promises.push(deleteDoc(d.ref)))
            claims.docs.forEach(d => promises.push(deleteDoc(d.ref)))
            chats.docs.forEach(d => promises.push(deleteDoc(d.ref)))
            
            await Promise.all(promises)
            toast.success('All items and data cleared successfully.')
            setMyItems([])
            setMyChats([])
        } catch (err) {
            console.error(err)
            toast.error('Failed to clear data.')
        } finally {
            setCleaning(false)
        }
    }

    if (!userProfile) return <div className="loading-spinner">Loading profile…</div>

    return (
        <div className="page-container narrow">
            <div className="profile-card glass">
                <div className="profile-avatar">{userProfile.name?.[0]?.toUpperCase()}</div>
                <div className="profile-info">
                    <h2>{userProfile.name}</h2>
                    <p>{userProfile.email}</p>
                </div>
                <div className="karma-display">
                    <span className="karma-star">⭐</span>
                    <span className="karma-value">{userProfile.karma}</span>
                    <span className="karma-label">Karma Points</span>
                </div>
                <div className="stats-row">
                    <div className="stat-item">
                        <span className="stat-val">{userProfile.itemsReported ?? 0}</span>
                        <span className="stat-label">Items Reported</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-val">{userProfile.itemsResolved ?? 0}</span>
                    </div>
                </div>
            </div>

            <div className="section">
                <h3>Account Settings</h3>
                <form onSubmit={handlePasswordChange} className="password-change-form glass" style={{ padding: '1.5rem', borderRadius: '12px', display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
                    <input 
                        type="password" 
                        placeholder="New Password (min 6 chars)" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="form-input"
                        style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={changingPassword} style={{ whiteSpace: 'nowrap' }}>
                        {changingPassword ? 'Updating...' : 'Change Password'}
                    </button>
                </form>
            </div>

            {myChats.length > 0 && (
                <div className="section">
                    <h3>My Chats</h3>
                    {myChats.map(chat => (
                        <Link key={chat.id} to={`/chat/${chat.id}`} className="chat-list-item glass">
                            💬 {chat.itemTitle}
                        </Link>
                    ))}
                </div>
            )}

            <div className="section">
                <h3>My Reports</h3>
                {myItems.length === 0 ? (
                    <p className="empty-state">You haven't reported any items yet.</p>
                ) : (
                    <div className="my-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {myItems.map(item => (
                            <div key={item.id} className="my-item-row glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem' }}>
                                <Link to={`/items/${item.id}`} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, textDecoration: 'none', color: 'inherit' }}>
                                    <span className={`type-badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>{item.type}</span>
                                    <span className="my-item-title" style={{ fontWeight: 600 }}>{item.title}</span>
                                    <span className={`status-chip status-${item.status}`}>{item.status}</span>
                                </Link>
                                <button 
                                    onClick={(e) => handleDeleteItem(item.id, e)} 
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: '#ef4444', padding: '0.25rem 0.5rem' }}
                                >
                                    🗑️ Delete
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="section" style={{ marginTop: '4rem', opacity: 0.6 }}>
                <h3 style={{ color: '#ef4444' }}>🛠 Developer Tools</h3>
                <div className="glass" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #fecaca' }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: '#b91c1c' }}>
                        Admin action: This button clears ALL listings, claims, and chats from the database. Use only for resetting the environment.
                    </p>
                    <button 
                        onClick={clearAllData} 
                        className="btn btn-ghost w-full" 
                        disabled={cleaning}
                        style={{ color: '#ef4444', border: '1px solid #fca5a5', fontWeight: 800 }}
                    >
                        {cleaning ? 'Clearing Database...' : '🗑️ Clear All Platform Data'}
                    </button>
                </div>
            </div>
        </div>
    )
}
