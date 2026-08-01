import { useNavigate } from "react-router-dom";
import { OnboardingWizard } from "../components/OnboardingWizard";
import { apiClient } from "../api/client";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import type { FullOnboardingPayload } from "../types/schema";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleComplete = async (payload: FullOnboardingPayload) => {
    // Set sessionStorage flag so App.tsx doesn't redirect the user back during state sync
    sessionStorage.setItem('completing_onboarding', 'true');

    // 1. Update Supabase auth user_metadata
    supabase.auth.updateUser({
      data: {
        name: payload.name,
        location: payload.location,
        onboarding_complete: true,
        target_roles: payload.preferences.target_roles,
        company_stage: payload.preferences.company_stage,
      },
    }).catch(console.error);

    // 2. Submit normalized onboarding payload to backend tables
    try {
      await apiClient.submitFullOnboarding(payload);
    } catch (e) {
      console.warn("Backend onboarding sync warning:", e);
    }

    // Immediately navigate to dashboard to show loading matching visual
    navigate("/dashboard");
  };

  return (
    <div className="onboarding-bg">
      <OnboardingWizard
        userId={user?.id || "usr_demo_01"}
        userEmail={user?.email || "arjun@sidedoor.internal"}
        onComplete={handleComplete}
      />
    </div>
  );
}
