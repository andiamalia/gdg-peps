import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import { getDb, getFirebaseAuth, isFirebaseConfigured, type UserDoc } from '../lib/firebase'

export type AuthState = {
  user: User | null
  profile: UserDoc | null
  loading: boolean
  configured: boolean
  ensureProfile: (displayName: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

async function readUserProfile(uid: string): Promise<UserDoc | null> {
  try {
    const snap = await getDoc(doc(getDb(), 'users', uid))
    return snap.exists() ? (snap.data() as UserDoc) : null
  } catch (error) {
    console.error('Failed to read user profile (check Firestore rules deploy)', error)
    return null
  }
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserDoc | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    if (!user) return
    setProfile(await readUserProfile(user.uid))
  }, [user])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }

    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, async (next) => {
      if (!next) {
        try {
          await signInAnonymously(auth)
        } catch (error) {
          console.error(error)
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
        return
      }

      setUser(next)
      setProfile(await readUserProfile(next.uid))
      setLoading(false)
    })

    return () => unsub()
  }, [])

  async function ensureProfile(displayName: string) {
    if (!user) throw new Error('Not signed in')
    const trimmed = displayName.trim()
    if (!trimmed) throw new Error('Display name is required')

    const ref = doc(getDb(), 'users', user.uid)
    const existing = await readUserProfile(user.uid)
    if (existing) {
      await setDoc(ref, { display_name: trimmed }, { merge: true })
    } else {
      const data: UserDoc = {
        display_name: trimmed,
        created_at: Date.now(),
      }
      await setDoc(ref, data)
    }
    setProfile(await readUserProfile(user.uid))
  }

  return {
    user,
    profile,
    loading,
    configured: isFirebaseConfigured,
    ensureProfile,
    refreshProfile,
  }
}
