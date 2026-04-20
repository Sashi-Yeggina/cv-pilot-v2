import { createClient } from '@supabase/supabase-js';

// Single shared Supabase client — never create more than one instance.
// Multiple instances cause "undefined behavior" warnings and session conflicts.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);
