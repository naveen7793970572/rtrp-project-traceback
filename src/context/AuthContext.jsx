import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../services/firebase'

const AuthContext = createContext(null)
const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || '@college.edu'

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  /* ---- Helpers ---- */
  function isDomainAllowed(email) {
    return !!email?.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase())
  }

  function validateCollegeEmail(email) {
    if (!isDomainAllowed(email)) {
      throw new Error(`Only ${ALLOWED_DOMAIN} email addresses are allowed.`)
    }
  }

  async function ensureUserDoc(user) {
    const ref = doc(db, 'users', user.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        name: user.displayName ?? user.email.split('@')[0],
        email: user.email,
        karma: 0,
        itemsReported: 0,
        itemsResolved: 0,
        createdAt: serverTimestamp(),
      })
    }
    const updated = await getDoc(ref)
    setUserProfile(updated.data())
  }

  /* ---- Email / Password ---- */
  async function signup(email, password, displayName) {
    validateCollegeEmail(email)
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    await ensureUserDoc({ ...cred.user, displayName })
    
    // Send verification email and sign out so they must verify before entering
    await sendEmailVerification(cred.user)
    await signOut(auth)
    
    return cred
  }

  async function login(email, password) {
    validateCollegeEmail(email)
    const cred = await signInWithEmailAndPassword(auth, email, password)
    
    if (!cred.user.emailVerified) {
      await signOut(auth)
      throw new Error('auth/email-unverified')
    }
    
    return cred
  }

  /* ---- Google Sign-In ---- */
  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    // Hard-check domain even if hd hint was set
    if (!isDomainAllowed(user.email)) {
      await signOut(auth)
      throw new Error(
        `Please use your ${ALLOWED_DOMAIN} Google account. Personal accounts are not allowed.`
      )
    }

    await ensureUserDoc(user)
    return result
  }

  /* ---- Logout & Password Reset ---- */
  function logout() {
    return signOut(auth)
  }

  function resetPassword(email) {
    validateCollegeEmail(email)
    return sendPasswordResetEmail(auth, email)
  }

  function changeUserPassword(newPassword) {
    if (!currentUser) throw new Error('Must be logged in to change password.')
    return updatePassword(currentUser, newPassword)
  }

  async function fetchProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) setUserProfile(snap.data())
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        try {
          await fetchProfile(user.uid)
        } catch (err) {
          console.warn('fetchProfile failed (Firestore rules may not be deployed):', err.message)
        }
      } else {
        setUserProfile(null)
      }
      setLoading(false) // always runs — never leaves the app blank
    })
    return unsub
  }, [])

  const value = {
    currentUser,
    userProfile,
    fetchProfile,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    changeUserPassword,
    ALLOWED_DOMAIN,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
