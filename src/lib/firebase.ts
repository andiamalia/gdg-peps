import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFunctions, type Functions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.appId,
)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let functions: Functions | null = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  const region = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string) || 'us-central1'
  functions = getFunctions(app, region)
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase is not configured. Copy .env.example to .env and fill values.')
  return auth
}

export function getDb(): Firestore {
  if (!db) throw new Error('Firebase is not configured. Copy .env.example to .env and fill values.')
  return db
}

export function getFirebaseFunctions(): Functions {
  if (!functions) throw new Error('Firebase is not configured. Copy .env.example to .env and fill values.')
  return functions
}

export type UserDoc = {
  display_name: string
  created_at: number
}

export type EventDoc = {
  title: string
  slug: string
  organizer_uid: string
  created_at: number
  is_active: boolean
  city?: string | null
}

export type InterviewStatus = 'pending' | 'in_progress' | 'ready'

export type MemberProfile = {
  hobbies: string[]
  interests: string[]
  origin: string
  occupation: string
  major: string
  city: string
  workplace_or_campus: string
  tech_stack: string[]
  looking_for: string[]
  free_text: string
}

export type MemberDoc = {
  display_name: string
  joined_at: number
  role: 'organizer' | 'member'
  interview_status: InterviewStatus
  interview_turns?: number
  profile?: MemberProfile
  profile_text?: string
  completeness?: number
  consent_at?: number | null
  consent_version?: string | null
}

export type CircleMatch = {
  uid: string
  display_name: string
  score: number
  reason: string
  icebreaker: string
}

export const CONSENT_VERSION = 'peps-v1'
