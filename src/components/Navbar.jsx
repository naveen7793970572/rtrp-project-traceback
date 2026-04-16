import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { currentUser, userProfile, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
    toast.success('Logged out')
    setMenuOpen(false)
  }

  const isActive = (path) => location.pathname === path

  const navLinks = [
    { to: '/', label: '🏠 Home' },
    { to: '/browse', label: '🗂 Browse' },
    { to: '/report', label: '➕ Report' },
    { to: '/matches', label: '🤖 Matches' },
  ]

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
        <span className="brand-icon">📍</span>
        TraceBack
      </Link>

      {currentUser && (
        <>
          {/* Desktop links */}
          <div className="navbar-links desktop-only">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to} className={`nav-link ${isActive(l.to) ? 'active' : ''}`}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className="navbar-right desktop-only">
            <button onClick={toggleTheme} className="btn btn-ghost btn-sm" style={{ padding: '0.45rem', borderRadius: '50%', width: '36px', height: '36px' }} title="Toggle Theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span className="karma-badge" title="Karma Points">⭐ {userProfile?.karma ?? 0}</span>
            <Link to="/profile" className="nav-avatar" title={currentUser.displayName}>
              {currentUser.displayName?.[0]?.toUpperCase() ?? '?'}
            </Link>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
          </div>

          {/* Mobile hamburger */}
          <div className="mobile-right">
            <button onClick={toggleTheme} className="btn btn-ghost btn-sm" style={{ padding: '0.45rem', borderRadius: '50%', width: '36px', height: '36px' }}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span className="karma-badge">⭐ {userProfile?.karma ?? 0}</span>
            <button
              className="hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>

          {/* Mobile drawer */}
          {menuOpen && (
            <div className="mobile-drawer glass">
              {navLinks.map(l => (
                <Link
                  key={l.to} to={l.to}
                  className={`mobile-nav-link ${isActive(l.to) ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
              <Link to="/profile" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                👤 Profile
              </Link>
              <button onClick={handleLogout} className="btn btn-ghost w-full" style={{ marginTop: '0.5rem' }}>
                Logout
              </button>
            </div>
          )}
        </>
      )}
    </nav>
  )
}
