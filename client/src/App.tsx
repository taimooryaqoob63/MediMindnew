import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import TrainingPage from "@/pages/training";
import LandingPage from "@/pages/landing";
import CourseManagement from "@/pages/courseManagement";
import DocumentManagement from "@/pages/documentManagement";
import RAGAnalytics from "@/pages/ragAnalytics";
import KnowledgeGraphPage from "@/pages/knowledgeGraph";


function CourseManagementWrapper() {
  const { user } = useAuth();
  return <CourseManagement user={user || null} />;
}

function DocumentManagementWrapper() {
  const { user } = useAuth();
  return <DocumentManagement user={user || null} />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
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
          <Route path="/analytics" component={() => <RAGAnalytics />} />
          <Route path="/knowledge-graph" component={() => <KnowledgeGraphPage />} />
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