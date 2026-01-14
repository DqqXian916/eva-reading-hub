import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ytmdebbwifoijqjymkal.supabase.co'
const supabaseKey = 'sb_publishable_KOhZ2OOHqc20Xhsx3Ia2kA_BXn7Q1pN'

export const supabase = createClient(supabaseUrl, supabaseKey)