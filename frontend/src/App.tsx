import { useEffect } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { useAuth, hasCompletedOnboarding } from "./lib/useAuth";

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Determine active tab for Navbar
  const activeTab: "landing" | "dashboard" =
    location.pathname === "/dashboard" ? "dashboard" : "landing";

  const handleTabChange = (tab: "landing" | "dashboard") => {
    if (tab === "dashboard") {
      if (!user) {
        navigate("/login");
      } else if (!hasCompletedOnboarding(user)) {
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
      }
    } else {
      navigate("/");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Redirect authenticated users who haven't completed onboarding to /onboarding
  useEffect(() => {
    const isCompleting = sessionStorage.getItem('completing_onboarding') === 'true';
    if (!loading && user && !hasCompletedOnboarding(user) && !isCompleting && location.pathname !== "/onboarding") {
      navigate("/onboarding");
    }
  }, [user, loading, location.pathname, navigate]);

  // Redirect authenticated users who have completed onboarding away from /onboarding and /login
  useEffect(() => {
    if (!loading && user && hasCompletedOnboarding(user) && (location.pathname === "/onboarding" || location.pathname === "/login")) {
      navigate("/dashboard");
    }
  }, [user, loading, location.pathname, navigate]);

  const isDashboard = location.pathname === "/dashboard";
  const hideNavbar = ["/dashboard", "/login", "/onboarding"].includes(location.pathname);

  // Show a blank screen while checking auth state (avoids flash of login page)
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#f0eadb",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%",
          border: "2px solid rgba(152,118,26,0.2)",
          borderTopColor: "#98761a",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
              if (!user) {
                navigate("/login");
              } else if (!hasCompletedOnboarding(user)) {
                navigate("/onboarding");
              } else {
                navigate("/dashboard");
              }
            }} />}
          />
          <Route
            path="/login"
            element={<LoginPage onBackToLanding={() => navigate("/")} />}
          />
          <Route
            path="/onboarding"
            element={
              user
                ? <OnboardingPage />
                : <LoginPage onBackToLanding={() => navigate("/")} />
            }
          />
          <Route
            path="/dashboard"
            element={<DashboardPage />}
          />
        </Routes>
      </main>

      {!hideNavbar && <Footer />}
    </div>
  );
}

export default App;
