import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ItemCard from '../components/ItemCard'

export default function HomePage() {
  const { currentUser, userProfile } = useAuth()
  const [recentFound, setRecentFound] = useState([])
  const [recentLost, setRecentLost] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ found: 0, lost: 0, resolved: 0 })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const now = Timestamp.now()

      const allFoundSnap = await getDocs(query(collection(db, 'items'), where('type', '==', 'found')))
      const allLostSnap = await getDocs(query(collection(db, 'items'), where('type', '==', 'lost')))
      const allItems = [...allFoundSnap.docs, ...allLostSnap.docs].map(d => ({ id: d.id, ...d.data() }))

      const validFound = allItems.filter(i => i.type === 'found' && (i.status === 'Found' || i.status === 'claimed') && i.expiresAt?.toMillis() > now.toMillis())
      validFound.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
      
      const validLost = allItems.filter(i => i.type === 'lost' && (i.status === 'open' || i.status === 'claimed') && i.expiresAt?.toMillis() > now.toMillis())
      validLost.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))

      const resolvedItems = allItems.filter(i => i.status === 'resolved' || i.status === 'returned')

      setRecentFound(validFound.slice(0, 6))
      setRecentLost(validLost.slice(0, 4))
      setStats({
        found: validFound.length,
        lost: validLost.length,
        resolved: resolvedItems.length,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🎓 Campus Lost &amp; Found</div>
          <h1 className="hero-title">
            Lost something?<br />
            <span className="gradient-text">We'll help you find it.</span>
          </h1>
          <p className="hero-sub">
            AI-powered matching connects lost items with what's been found on campus. 
            Fast, private, and completely free.
          </p>
          <div className="hero-actions">
            <Link to="/report?type=lost" className="btn btn-primary btn-lg">🔍 Report Lost Item</Link>
            <Link to="/report?type=found" className="btn btn-outline btn-lg">🤲 Report Found Item</Link>
          </div>
        </div>
      </section>

      {/* Recent Found Items */}
      <section className="home-section">
        <div className="section-header">
          <h2 className="section-title">Recently Found</h2>
          <Link to="/browse?type=found" className="see-all-link">See all →</Link>
        </div>
        {loading ? (
          <div className="loading-spinner">Loading…</div>
        ) : recentFound.length === 0 ? (
          <div className="empty-state">No found items yet. Be the first to report one!</div>
        ) : (
          <div className="items-grid">{recentFound.map(i => <ItemCard key={i.id} item={i} />)}</div>
        )}
      </section>

      {/* Recent Lost Items */}
      {recentLost.length > 0 && (
        <section className="home-section">
          <div className="section-header">
            <h2 className="section-title">Recently Lost</h2>
            <Link to="/browse?type=lost" className="see-all-link">See all →</Link>
          </div>
          <div className="items-grid">{recentLost.map(i => <ItemCard key={i.id} item={i} />)}</div>
        </section>
      )}

      {/* CTA for karma */}
      {userProfile && (
        <section className="karma-cta glass">
          <div className="karma-cta-inner">
            <span className="karma-cta-icon">⭐</span>
            <div>
              <h3>Your Karma: <span className="gradient-text">{userProfile.karma} pts</span></h3>
              <p>Earn +10 by reporting a found item. Every good deed counts!</p>
            </div>
            <Link to="/report?type=found" className="btn btn-primary">Report Found Item</Link>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="how-it-works">
        <h2 className="section-title">How TraceBack Works</h2>
        <div className="steps-grid">
          {[
            { icon: '📸', step: '1', title: 'Report', desc: 'Post a found item with a photo, or describe what you lost.' },
            { icon: '🤖', step: '2', title: 'AI Matches', desc: 'Our image AI compares your report against all active listings.' },
            { icon: '💬', step: '3', title: 'Chat & Claim', desc: 'Once a match is accepted, a private chat opens to arrange return.' },
            { icon: '⭐', step: '4', title: 'Earn Karma', desc: 'Get karma points for helping others find their belongings.' },
          ].map(s => (
            <div key={s.step} className="step-card glass">
              <div className="step-icon">{s.icon}</div>
              <div className="step-num">Step {s.step}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
