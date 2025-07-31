import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import TrainingPage from "@/pages/training";
import LandingPage from "@/pages/landing";

// Loading component
function LoadingPage() {
  return (
    <div className="min-h-screen bg-[hsl(210,40%,98%)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[hsl(202,60%,42%)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="*" component={LandingPage} />
      ) : (
        <>
          <Route path="/" component={TrainingPage} />
          <Route path="/training" component={TrainingPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
