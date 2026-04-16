import { Link } from 'react-router-dom'

// Map internal status to display labels
const STATUS_LABELS = {
  open: 'Open',
  found: 'Found',
  matched: 'Matched',
  claimed: 'Claimed',
  resolved: 'Returned',
}

export default function ItemCard({ item }) {
  const daysLeft = item.expiresAt
    ? Math.ceil((item.expiresAt.toDate() - Date.now()) / 86400000)
    : null

  const statusLabel = STATUS_LABELS[item.status] ?? item.status

  return (
    <Link to={`/items/${item.id}`} className="item-card">
      <div className="item-card-img">
        {item.imageURL
          ? <img src={item.imageURL} alt={item.title} loading="lazy" />
          : <div className="item-no-img">📦</div>
        }
        <span className={`type-badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
          {item.type === 'lost' ? 'Lost' : 'Found'}
        </span>
      </div>

      <div className="item-card-body">
        <h3 className="item-title">{item.title}</h3>

        <div className="item-meta">
          {/* Category */}
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>📂 {item.category}</span>
          {/* Location tag */}
          <span className="location-tag">📍 {item.location}</span>
        </div>

        {item.description && (
          <p className="item-desc">
            {item.description.slice(0, 85)}{item.description.length > 85 ? '…' : ''}
          </p>
        )}

        <div className="item-card-footer">
          <span className={`status-chip status-${item.status}`}>{statusLabel}</span>
          {daysLeft !== null && daysLeft >= 0 && (
            <span className="expiry-label">⏳ {daysLeft}d left</span>
          )}
        </div>
      </div>
    </Link>
  )
}
