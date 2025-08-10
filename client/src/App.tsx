import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SkipLinks } from "@/components/AccessibilityEnhancements";
import NotFound from "@/pages/not-found";
import TrainingPage from "@/pages/training";
import LandingPage from "@/pages/landing";
import CourseManagement from "@/pages/courseManagement";
import DocumentManagement from "@/pages/documentManagement";


function CourseManagementWrapper() {
  const { user } = useAuth();
  return <CourseManagement user={user || null} />;
}

function DocumentManagementWrapper() {
  const { user } = useAuth();
  return <DocumentManagement user={user || null} />;
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { track, setUserId } = useAnalytics();

  useEffect(() => {
    if (user?.id) {
      setUserId(user.id);
    }
  }, [user?.id, setUserId]);

  useEffect(() => {
    // Track page views
    const handleRouteChange = () => {
      track("page_view", { page: window.location.pathname });
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, [track]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg" role="status" aria-live="polite">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={LandingPage} />
        </>
      ) : (
        <>
          <Route path="/" component={TrainingPage} />
          <Route path="/training" component={TrainingPage} />
          <Route path="/manage" component={CourseManagementWrapper} />
          <Route path="/documents" component={DocumentManagementWrapper} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SkipLinks />
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
