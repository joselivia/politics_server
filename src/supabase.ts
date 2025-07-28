import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL="https://nzpyjgwokuocjfaueqwv.supabase.co"
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56cHlqZ3dva3VvY2pmYXVlcXd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3Mzk1NDAsImV4cCI6MjA2ODMxNTU0MH0.KpmlCkPuEcKbRiFRnmEa4iBobo9ifHqwtbN1CHiswnM"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
