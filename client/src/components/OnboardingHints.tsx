import { useState, useEffect } from "react";
import { X, BookOpen, MessageCircle, PlayCircle, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  target?: string;
  completed?: boolean;
}

interface OnboardingHintsProps {
  isFirstTime?: boolean;
  currentPage?: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to MediMind AI",
    description: "Your AI-powered diabetes training platform. Let's get started with a quick tour.",
    icon: BookOpen,
  },
  {
    id: "courses",
    title: "Browse Training Modules",
    description: "Select from our comprehensive diabetes care training courses on the left sidebar.",
    icon: PlayCircle,
    target: "sidebar",
  },
  {
    id: "video",
    title: "Watch & Learn",
    description: "Watch training videos and track your progress. Bookmark important sections for later review.",
    icon: PlayCircle,
    target: "video-section",
  },
  {
    id: "ai-tutor",
    title: "Ask the AI Tutor",
    description: "Get instant answers to your questions with our evidence-based AI assistant.",
    icon: MessageCircle,
    target: "ai-chat",
  },
];

export default function OnboardingHints({ isFirstTime = false, currentPage = "training" }: OnboardingHintsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check if user has seen onboarding before
    const hasSeenOnboarding = localStorage.getItem("medimind-onboarding-completed");
    
    if (isFirstTime && !hasSeenOnboarding) {
      setIsVisible(true);
    }
  }, [isFirstTime]);

  useEffect(() => {
    // Auto-advance steps based on user actions
    const checkStepCompletion = () => {
      const step = onboardingSteps[currentStep];
      if (!step) return;

      // Simple completion detection based on DOM elements
      let isCompleted = false;
      switch (step.id) {
        case "welcome":
          isCompleted = true; // Always mark welcome as completed after showing
          break;
        case "courses":
          isCompleted = document.querySelector('[data-testid="sidebar"]') !== null;
          break;
        case "video":
          isCompleted = document.querySelector('video') !== null;
          break;
        case "ai-tutor":
          isCompleted = document.querySelector('[data-testid="ai-chat"]') !== null;
          break;
      }

      if (isCompleted && !completedSteps.has(step.id)) {
        setCompletedSteps(prev => new Set([...Array.from(prev), step.id]));
      }
    };

    const interval = setInterval(checkStepCompletion, 1000);
    return () => clearInterval(interval);
  }, [currentStep, completedSteps]);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("medimind-onboarding-completed", "true");
    setIsVisible(false);
  };

  const handleSkip = () => {
    localStorage.setItem("medimind-onboarding-completed", "true");
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  const currentStepData = onboardingSteps[currentStep];
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <currentStepData.icon className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleComplete}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Step {currentStep + 1} of {onboardingSteps.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            {currentStepData.description}
          </p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2">
            {onboardingSteps.map((step, index) => (
              <div
                key={step.id}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index <= currentStep
                    ? completedSteps.has(step.id)
                      ? "bg-green-500"
                      : "bg-primary"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>

          {/* Completion badge */}
          {completedSteps.has(currentStepData.id) && (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Step completed!</span>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between pt-4">
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handlePrevious}>
                  Previous
                </Button>
              )}
              <Button variant="ghost" onClick={handleSkip} className="text-gray-500">
                Skip Tour
              </Button>
            </div>
            
            <Button onClick={handleNext} className="flex items-center gap-2">
              {currentStep === onboardingSteps.length - 1 ? (
                <>
                  <Check className="w-4 h-4" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Tooltip component for contextual hints
interface TooltipHintProps {
  children: React.ReactNode;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  showOnFirstVisit?: boolean;
}

export function TooltipHint({ children, content, side = "top", showOnFirstVisit = false }: TooltipHintProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (showOnFirstVisit) {
      const hasSeenHint = localStorage.getItem(`medimind-hint-${content.slice(0, 20)}`);
      if (!hasSeenHint) {
        setShow(true);
        localStorage.setItem(`medimind-hint-${content.slice(0, 20)}`, "true");
      }
    }
  }, [content, showOnFirstVisit]);

  if (!show && showOnFirstVisit) {
    return (
      <div className="relative group">
        {children}
        <div className={`
          absolute z-10 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg
          opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none
          ${side === "top" ? "bottom-full left-1/2 transform -translate-x-1/2 mb-2" : ""}
          ${side === "bottom" ? "top-full left-1/2 transform -translate-x-1/2 mt-2" : ""}
          ${side === "left" ? "right-full top-1/2 transform -translate-y-1/2 mr-2" : ""}
          ${side === "right" ? "left-full top-1/2 transform -translate-y-1/2 ml-2" : ""}
          max-w-xs whitespace-normal
        `}>
          {content}
          <div className={`
            absolute w-2 h-2 bg-gray-900 transform rotate-45
            ${side === "top" ? "top-full left-1/2 -translate-x-1/2 -mt-1" : ""}
            ${side === "bottom" ? "bottom-full left-1/2 -translate-x-1/2 -mb-1" : ""}
            ${side === "left" ? "left-full top-1/2 -translate-y-1/2 -ml-1" : ""}
            ${side === "right" ? "right-full top-1/2 -translate-y-1/2 -mr-1" : ""}
          `} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}