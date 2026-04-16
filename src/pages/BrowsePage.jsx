import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import ItemCard from '../components/ItemCard'

const CATEGORIES = ['All', 'Electronics', 'ID / Cards', 'Bags', 'Clothing', 'Books', 'Keys', 'Jewellery', 'Sports', 'Other']
const LOCATIONS = ['All', 'Library', 'Canteen', 'Hostel', 'Main Block', 'Labs', 'Auditorium', 'Sports Ground', 'Parking', 'Other']

export default function BrowsePage() {
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('type') === 'found' ? 'found' : 'lost'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [location, setLocation] = useState('All')

  useEffect(() => { fetchItems() }, [activeTab])

  async function fetchItems() {
    setLoading(true)
    try {
      const now = Timestamp.now()
      const q = query(collection(db, 'items'), where('type', '==', activeTab))
      const snap = await getDocs(q)
      let results = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      results = results.filter(i => i.status === (activeTab === 'found' ? 'Found' : 'open') && i.expiresAt?.toMillis() > now.toMillis())
      results.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
      setItems(results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(item => {
    const matchSearch = !search ||
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || item.category === category
    const matchLoc = location === 'All' || item.location === location
    return matchSearch && matchCat && matchLoc
  })

  return (
    <div className="page-container">
      <div className="browse-header">
        <h2>Browse Items</h2>
        <div className="tab-row">
          <button className={`tab-btn ${activeTab === 'lost' ? 'active' : ''}`} onClick={() => setActiveTab('lost')}>
            🔍 Lost Items
          </button>
          <button className={`tab-btn ${activeTab === 'found' ? 'active' : ''}`} onClick={() => setActiveTab('found')}>
            🤲 Found Items
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="🔍 Search by keyword…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={location} onChange={e => setLocation(e.target.value)}>
          {LOCATIONS.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>🗂</p>
          <p>No {activeTab} items match your filters.</p>
        </div>
      ) : (
        <div className="items-grid">
          {filtered.map(item => <ItemCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}
