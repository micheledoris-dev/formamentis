import { createClient } from '@supabase/supabase-js'

const rawUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const rawKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim()

const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(rawUrl)
const validKey = rawKey.startsWith('sb_publishable_') || rawKey.startsWith('eyJ')

export const supabaseConfigurationError = !rawUrl || !rawKey
  ? 'Supabase non configurato: modalità locale attiva.'
  : !validUrl
    ? 'URL Supabase non valido. Controlla VITE_SUPABASE_URL su Netlify.'
    : !validKey
      ? 'Chiave Supabase non valida. Controlla VITE_SUPABASE_ANON_KEY su Netlify.'
      : ''

export const supabaseConfigured = Boolean(validUrl && validKey)
export const supabase = supabaseConfigured
  ? createClient(rawUrl, rawKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null
