import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { findMatches } from '../services/matchingService'
import { Link } from 'react-router-dom'

export default function MatchesPage() {
  const { currentUser } = useAuth()
  const [myItems, setMyItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [matches, setMatches] = useState([])
  const [loadingMatches, setLoadingMatches] = useState(false)

  useEffect(() => { loadMyItems() }, [])

  async function loadMyItems() {
    const q = query(
      collection(db, 'items'),
      where('reportedBy', '==', currentUser.uid)
    )
    const snap = await getDocs(q)
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status === 'open' || i.status === 'Found')
    setMyItems(items)
    if (items.length > 0) findMatchesFor(items[0])
  }

  async function findMatchesFor(item) {
    setSelectedItem(item)
    setMatches([])
    setLoadingMatches(true)
    try {
      const opposite = item.type === 'lost' ? 'found' : 'lost'
      const targetStatus = opposite === 'found' ? 'Found' : 'open'
      const now = Timestamp.now()
      const q = query(collection(db, 'items'), where('type', '==', opposite))
      const snap = await getDocs(q)
      let candidates = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      candidates = candidates.filter(c => c.status === targetStatus && c.expiresAt?.toMillis() > now.toMillis())
      setMatches(findMatches(item, candidates))
    } finally {
      setLoadingMatches(false)
    }
  }

  function ConfidenceBar({ score }) {
    const pct = Math.round(score * 100)
    const color = pct >= 75 ? '#4ade80' : pct >= 55 ? '#fbbf24' : '#7c6aff'
    return (
      <div className="conf-bar-wrap">
        <div className="conf-bar-track">
          <div className="conf-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="conf-label" style={{ color }}>{pct}% match</span>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="matches-page-header">
        <h2>🤖 AI Match Suggestions</h2>
        <p className="text-muted">Select one of your open items to see potential matches found by image AI.</p>
      </div>

      {myItems.length === 0 ? (
        <div className="empty-state glass" style={{ padding: '3rem', marginTop: '2rem' }}>
          <p style={{ fontSize: '2rem' }}>🔍</p>
          <p>You have no open items yet.</p>
          <Link to="/report" className="btn btn-primary" style={{ marginTop: '1rem' }}>Report an Item</Link>
        </div>
      ) : (
        <div className="matches-layout">
          {/* My items list */}
          <aside className="my-items-sidebar">
            <h4>My Open Items</h4>
            {myItems.map(item => (
              <button
                key={item.id}
                className={`sidebar-item ${selectedItem?.id === item.id ? 'active' : ''}`}
                onClick={() => findMatchesFor(item)}
              >
                {item.imageURL
                  ? <img src={item.imageURL} alt={item.title} />
                  : <div className="sidebar-no-img">📦</div>
                }
                <div className="sidebar-item-info">
                  <strong>{item.title}</strong>
                  <span className={`type-badge-sm ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>{item.type}</span>
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>📍 {item.location}</span>
                </div>
              </button>
            ))}
          </aside>

          {/* Matches results */}
          <div className="matches-results">
            {loadingMatches ? (
              <div className="loading-spinner">Scanning with AI…</div>
            ) : matches.length === 0 && selectedItem ? (
              <div className="empty-state glass" style={{ padding: '2.5rem' }}>
                <p style={{ fontSize: '2rem' }}>😕</p>
                <p>No strong matches found yet for <strong>{selectedItem.title}</strong>.</p>
                <p className="text-muted" style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>Check back later as more items are reported.</p>
              </div>
            ) : (
              <div className="match-cards-list">
                {matches.map((m, i) => (
                  <div key={m.id} className="match-result-card glass">
                    <div className="match-rank">#{i + 1}</div>
                    {m.imageURL && (
                      <div className="match-img-wrap">
                        <img src={m.imageURL} alt={m.title} loading="lazy" />
                      </div>
                    )}
                    <div className="match-result-body">
                      <div className="match-result-header">
                        <h3>{m.title}</h3>
                        <span className={`type-badge ${m.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>{m.type}</span>
                      </div>
                      <ConfidenceBar score={m.score} />
                      <div className="match-meta">
                        <span>📂 {m.category}</span>
                        <span>📍 {m.location}</span>
                        {m.date && <span>📅 {m.date}</span>}
                      </div>
                      {m.description && <p className="match-desc">{m.description?.slice(0, 120)}…</p>}
                      <Link to={`/items/${m.id}`} className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
                        View Item & Claim →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
