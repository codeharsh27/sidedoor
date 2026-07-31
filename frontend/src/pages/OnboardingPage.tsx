
import { useNavigate } from "react-router-dom";
import { OnboardingWizard } from "../components/OnboardingWizard";
import { apiClient } from "../api/client";
import type { OnboardingData, UserProfile } from "../types/schema";

interface OnboardingPageProps {
  userId: string;
  onComplete: (profile: UserProfile) => void;
}

export function OnboardingPage({ userId, onComplete }: OnboardingPageProps) {
  const navigate = useNavigate();

  const handleComplete = async (data: OnboardingData) => {
    const profile = await apiClient.saveOnboardingProfile(userId, data);
    onComplete(profile);
    navigate("/dashboard");
  };

  return (
    <div className="onboarding-bg">
      <OnboardingWizard userId={userId} onComplete={handleComplete} />
    </div>
  );
}
