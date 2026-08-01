import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type SupabaseUser = {
  id: string;
  email: string | undefined;
  user_metadata: {
    name?: string;
    location?: string;
    user_type?: string;
    onboarding_complete?: boolean;
    onboarding?: {
      role?: string;
      years_experience?: string;
      focus?: string;
      tech_stack?: string[];
      domains?: string[];
      github_url?: string;
      project_summary?: string;
      target_investors?: string[];
      company_values?: string[];
    };
  };
  created_at: string;
  email_confirmed_at?: string;
};
