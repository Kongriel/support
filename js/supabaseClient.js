import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://qdejuowzcsxrizneitey.supabase.co";

export const SUPABASE_ANON_KEY = "sb_publishable_t6dB3G5tnStoC1pY1iIKbg_9LPtksXQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
