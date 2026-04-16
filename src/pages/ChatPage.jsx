import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    doc, getDoc, collection, query, orderBy,
    onSnapshot, addDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function ChatPage() {
    const { chatId } = useParams()
    const { currentUser } = useAuth()
    const navigate = useNavigate()

    const [chat, setChat] = useState(null)
    const [messages, setMessages] = useState([])
    const [loadingMessages, setLoadingMessages] = useState(true)
    const [otherUserName, setOtherUserName] = useState('')
    const [text, setText] = useState('')
    const [itemStatus, setItemStatus] = useState('claimed')
    const [error, setError] = useState(null)
    const bottomRef = useRef(null)
    const inputRef = useRef(null)

    // ── Scroll to bottom whenever messages update ──────────────────────────────
    useEffect(() => {
        if (messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    // ── Load chat doc + subscribe to messages ──────────────────────────────────
    useEffect(() => {
        if (!chatId || !currentUser) return

        let unsubMessages = null
        let unsubItem = null

        async function init() {
            try {
                // 1. Fetch the chat document
                const chatSnap = await getDoc(doc(db, 'chats', chatId))
                if (!chatSnap.exists()) {
                    toast.error('Chat not found.')
                    navigate('/')
                    return
                }

                const chatData = chatSnap.data()

                // 2. Security: current user must be a participant
                if (!chatData.participants?.includes(currentUser.uid)) {
                    toast.error('You are not a participant in this chat.')
                    navigate('/')
                    return
                }

                setChat(chatData)

                // 3. Fetch the other participant's display name
                const otherId = chatData.participants.find(p => p !== currentUser.uid)
                if (otherId) {
                    try {
                        const userSnap = await getDoc(doc(db, 'users', otherId))
                        if (userSnap.exists()) {
                            setOtherUserName(userSnap.data().name || 'Other user')
                        }
                    } catch (_) {
                        // Non-critical — name display is informational only
                    }
                }

                // 4. Subscribe to item status changes (to detect "returned")
                if (chatData.itemId) {
                    unsubItem = onSnapshot(
                        doc(db, 'items', chatData.itemId),
                        (snap) => { if (snap.exists()) setItemStatus(snap.data().status) },
                        (err) => console.warn('Item status listener:', err.message)
                    )
                }

                // 5. Subscribe to messages — real-time, ordered by createdAt
                const msgsQuery = query(
                    collection(db, 'chats', chatId, 'messages'),
                    orderBy('createdAt', 'asc')
                )
                unsubMessages = onSnapshot(
                    msgsQuery,
                    (snap) => {
                        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
                        setLoadingMessages(false)
                    },
                    (err) => {
                        console.error('Messages listener error:', err.code, err.message)
                        setLoadingMessages(false)
                        if (err.code === 'permission-denied') {
                            setError(
                                'Permission denied — make sure your Firestore security rules are deployed correctly.'
                            )
                        } else {
                            setError('Failed to load messages. Please refresh and try again.')
                        }
                    }
                )
            } catch (err) {
                console.error('ChatPage init error:', err.code, err.message)
                if (err.code === 'permission-denied') {
                    toast.error('Access denied. You are not a participant in this chat.')
                } else {
                    toast.error('Failed to load chat. Please try again.')
                }
                navigate('/')
            }
        }

        init()

        return () => {
            unsubMessages?.()
            unsubItem?.()
        }
    }, [chatId, currentUser])

    // ── Send message ───────────────────────────────────────────────────────────
    async function sendMessage(e) {
        e.preventDefault()
        const trimmed = text.trim()
        if (!trimmed) return
        if (isClosed) return

        setText('')
        inputRef.current?.focus()

        try {
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text: trimmed,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'User',
                createdAt: serverTimestamp(),
            })
        } catch (err) {
            console.error('sendMessage error:', err.code, err.message)
            setText(trimmed) // restore text so user doesn't lose it
            if (err.code === 'permission-denied') {
                toast.error('Permission denied — check your Firestore security rules.')
            } else {
                toast.error('Failed to send message. Please try again.')
            }
        }
    }

    const isClosed = itemStatus === 'returned' || itemStatus === 'resolved'

    // ── Format timestamp safely ────────────────────────────────────────────────
    function formatTime(ts) {
        if (!ts) return ''
        try {
            return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } catch {
            return ''
        }
    }

    return (
        <div className="chat-page">
            {/* ── Header ── */}
            <div className="chat-header">
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>←</button>
                <div style={{ flex: 1 }}>
                    <h3>{chat?.itemTitle ?? 'Chat'}</h3>
                    <p className="chat-sub">
                        {otherUserName ? `Chatting with ${otherUserName}` : 'Secure in-platform chat'}
                    </p>
                </div>
                {isClosed && (
                    <span className="status-chip status-returned" style={{ marginLeft: 'auto' }}>
                        Closed
                    </span>
                )}
            </div>

            {/* ── Safety notice ── */}
            <div style={{
                background: '#fffbeb', color: '#b45309',
                padding: '0.6rem 1rem', fontSize: '0.82rem',
                fontWeight: 600, textAlign: 'center',
                borderBottom: '1px solid #fde68a'
            }}>
                ⚠️ Coordinate item return only. Do not share personal passwords or sensitive info.
            </div>

            {/* ── Message area ── */}
            {error ? (
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: '2rem',
                    color: '#ef4444', fontWeight: 600, textAlign: 'center', flexDirection: 'column', gap: '0.5rem'
                }}>
                    <span style={{ fontSize: '2rem' }}>⚠️</span>
                    <p>{error}</p>
                </div>
            ) : (
                <div className="chat-messages">
                    {loadingMessages && (
                        <div style={{
                            textAlign: 'center', color: 'var(--text-muted)',
                            fontSize: '0.9rem', marginTop: '2rem'
                        }}>
                            Loading messages…
                        </div>
                    )}

                    {!loadingMessages && messages.length === 0 && (
                        <div style={{
                            textAlign: 'center', color: 'var(--text-muted)',
                            fontSize: '0.9rem', marginTop: '2rem'
                        }}>
                            No messages yet. Start the conversation! 👋
                        </div>
                    )}

                    {messages.map(msg => {
                        const isMine = msg.senderId === currentUser.uid
                        return (
                            <div
                                key={msg.id}
                                className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}
                            >
                                {!isMine && (
                                    <span className="msg-sender">{msg.senderName || 'User'}</span>
                                )}
                                <p>{msg.text}</p>
                                <span className="msg-time">{formatTime(msg.createdAt)}</span>
                            </div>
                        )
                    })}

                    <div ref={bottomRef} />
                </div>
            )}

            {/* ── Input area ── */}
            {isClosed ? (
                <div className="chat-input-row" style={{ justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                    ✅ Item has been marked as Returned. Chat is now closed.
                </div>
            ) : (
                <form className="chat-input-row" onSubmit={sendMessage}>
                    <input
                        ref={inputRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Type a message…"
                        autoFocus
                        disabled={!!error}
                        onKeyDown={e => {
                            // Allow Shift+Enter for new lines — Enter alone submits
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                sendMessage(e)
                            }
                        }}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={!text.trim() || !!error}
                    >
                        Send
                    </button>
                </form>
            )}
        </div>
    )
}
