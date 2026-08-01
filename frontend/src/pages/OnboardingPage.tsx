import { useNavigate } from "react-router-dom";
import { OnboardingWizard } from "../components/OnboardingWizard";
import { apiClient } from "../api/client";
import { supabase } from "../lib/supabase";
import { useAuth, getUserDisplayName } from "../lib/useAuth";
import type { OnboardingData } from "../types/schema";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleComplete = async (
    data: OnboardingData & { name: string; location: string; user_type: string }
  ) => {
    // 1. Save to Supabase user_metadata (persists across sessions, no backend needed)
    await supabase.auth.updateUser({
      data: {
        name: data.name || getUserDisplayName(user),
        location: data.location,
        user_type: data.user_type,
        onboarding_complete: true,
        onboarding: {
          role: data.role,
          years_experience: data.years_experience,
          focus: data.focus,
          tech_stack: data.tech_stack,
          domains: data.domains,
          github_url: data.github_url,
          project_summary: data.project_summary,
          target_investors: data.target_investors,
          company_values: data.company_values,
        },
      },
    });

    // 2. Also sync with backend profile (best-effort, non-blocking)
    if (user?.id) {
      apiClient.saveOnboardingProfile(user.id, data).catch(console.warn);
    }

    navigate("/dashboard");
  };

  return (
    <div className="onboarding-bg">
      <OnboardingWizard
        userName={user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? ""}
        onComplete={handleComplete}
      />
    </div>
  );
}
