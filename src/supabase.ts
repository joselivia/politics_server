import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL="https://yyrhhftgyyqnirkmpkyo.supabase.co"
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cmhoZnRneXlxbmlya21wa3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMjQ1NjQsImV4cCI6MjA2NzgwMDU2NH0.flwPeEJPDIMiVSvplV1s4GdU-aSIm3H3MmXS2FAryJ0"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
