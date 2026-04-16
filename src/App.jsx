import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import BrowsePage from './pages/BrowsePage'
import ReportItemPage from './pages/ReportItemPage'
import ItemDetailPage from './pages/ItemDetailPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import MatchesPage from './pages/MatchesPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
        <Navbar />
        <main>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/browse" element={<ProtectedRoute><BrowsePage /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute><ReportItemPage /></ProtectedRoute>} />
            <Route path="/matches" element={<ProtectedRoute><MatchesPage /></ProtectedRoute>} />
            <Route path="/items/:id" element={<ProtectedRoute><ItemDetailPage /></ProtectedRoute>} />
            <Route path="/chat/:chatId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          </Routes>
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #313244' },
          }}
        />
      </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
