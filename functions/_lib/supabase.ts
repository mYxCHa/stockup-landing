// Shared Supabase connection constants for the Pages Functions.
//
// These are the PUBLIC project URL and anon key - the same key the app binary
// ships with. They are public by design; RLS is the protection boundary, not
// secrecy of this key (see functions/_lib/product.ts for the read path and
// functions/waitlist.ts for the waitlist insert path). Hoisted here so both
// have one source of truth.

export const SUPABASE_URL = 'https://xnbswcbdqizmbqbhqlua.supabase.co';

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuYnN3Y2JkcWl6bWJxYmhxbHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDc5MjMsImV4cCI6MjA4ODAyMzkyM30.OBXWTtPrKGaRMrgDu_UbTYxP3NG8VhDngDG_TYsL_Yw';
