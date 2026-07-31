import { useState, useEffect } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import type { UserProfile } from "./types/schema";

const readStoredJson = <T,>(key: string): T | null => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"landing" | "dashboard">("landing");

  // Auth state
  const [userSession, setUserSession] = useState<{ userId: string; email: string; name: string | null } | null>(() => {
    return readStoredJson("user_session");
  });

  // Global App State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    return readStoredJson("user_profile");
  });

  // Sync navbar with current route
  useEffect(() => {
    if (location.pathname === "/dashboard") {
      setActiveTab("dashboard");
    } else {
      setActiveTab("landing");
    }
  }, [location.pathname]);

  const handleTabChange = (tab: "landing" | "dashboard") => {
    if (tab === "dashboard") {
      if (!userSession) {
        navigate("/login");
      } else if (!userProfile) {
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
      }
    } else {
      navigate("/");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLoginSuccess = (user: {
    userId: string;
    email: string;
    name: string | null;
    profile: UserProfile | null;
  }) => {
    const sessionData = { userId: user.userId, email: user.email, name: user.name };
    localStorage.setItem("user_session", JSON.stringify(sessionData));
    setUserSession(sessionData);

    if (user.profile) {
      localStorage.setItem("user_profile", JSON.stringify(user.profile));
      setUserProfile(user.profile);
      // Returning user with existing profile - go straight to dashboard
      navigate("/dashboard");
    } else {
      localStorage.removeItem("user_profile");
      setUserProfile(null);
      // New user - go through onboarding wizard
      navigate("/onboarding");
    }
  };

  const handleOnboardingComplete = (profile: UserProfile) => {
    localStorage.setItem("user_profile", JSON.stringify(profile));
    setUserProfile(profile);
  };

  const isDashboard = location.pathname === "/dashboard";
  const hideNavbar = ["/dashboard", "/login", "/onboarding"].includes(location.pathname);

  return (
    <div style={{
      height: isDashboard ? "100vh" : "auto",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: isDashboard ? "hidden" : "visible"
    }}>
      {!hideNavbar && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
        />
      )}

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: isDashboard ? "hidden" : "visible" }}>
        <Routes>
          <Route
            path="/"
            element={<LandingPage onTriggerUpload={() => {
              if (!userSession) {
                navigate("/login");
              } else if (!userProfile) {
                navigate("/onboarding");
              } else {
                navigate("/dashboard");
              }
            }} />}
          />
          <Route
            path="/login"
            element={<LoginPage onLoginSuccess={handleLoginSuccess} onBackToLanding={() => navigate("/")} />}
          />
          <Route
            path="/onboarding"
            element={
              userSession
                ? <OnboardingPage userId={userSession.userId} onComplete={handleOnboardingComplete} />
                : <LoginPage onLoginSuccess={handleLoginSuccess} onBackToLanding={() => navigate("/")} />
            }
          />
          <Route
            path="/dashboard"
            element={<DashboardPage globalProfile={userProfile} userSession={userSession} />}
          />
        </Routes>
      </main>

      {!hideNavbar && <Footer />}
    </div>
  );
}

export default App;
