import { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, AlertTriangle, Home, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: Date.now().toString(36),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Report error to analytics if available
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Track error in simple analytics
    if (typeof window !== "undefined") {
      try {
        const errorData = {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        };
        localStorage.setItem(`medimind-error-${this.state.errorId}`, JSON.stringify(errorData));
      } catch (e) {
        // Silently fail if localStorage is not available
      }
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined });
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleReport = () => {
    const subject = encodeURIComponent(`MediMind AI Error Report - ${this.state.errorId}`);
    const body = encodeURIComponent(`
Error ID: ${this.state.errorId}
Error Message: ${this.state.error?.message || "Unknown error"}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}

Please describe what you were doing when this error occurred:
[Your description here]
    `);
    
    window.open(`mailto:support@medimind.ai?subject=${subject}&body=${body}`);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-white dark:bg-gray-800 shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-xl text-gray-900 dark:text-gray-100">
                Something went wrong
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  We encountered an unexpected error. Don't worry - your progress is saved and you can try again.
                </AlertDescription>
              </Alert>

              {this.state.error && (
                <details className="text-sm text-gray-600 dark:text-gray-400">
                  <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                    Technical details (click to expand)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono break-all">
                    <div className="mb-2">
                      <strong>Error ID:</strong> {this.state.errorId}
                    </div>
                    <div className="mb-2">
                      <strong>Message:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">{this.state.error.stack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="space-y-3 pt-4">
                <Button 
                  onClick={this.handleRetry} 
                  className="w-full flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={this.handleGoHome}
                    className="flex items-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Go Home
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={this.handleReport}
                    className="flex items-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Report Issue
                  </Button>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-4 border-t">
                If this issue persists, please contact our support team with Error ID: {this.state.errorId}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Network Error Component
interface NetworkErrorProps {
  onRetry?: () => void;
  message?: string;
}

export function NetworkError({ onRetry, message = "Unable to connect to the server" }: NetworkErrorProps) {
  return (
    <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
      <AlertDescription className="text-red-800 dark:text-red-200">
        <div className="flex items-center justify-between">
          <span>{message}. Please check your connection and try again.</span>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

// API Error Component
interface ApiErrorProps {
  error: any;
  onRetry?: () => void;
}

export function ApiError({ error, onRetry }: ApiErrorProps) {
  const getErrorMessage = (error: any): string => {
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.status === 401) return "You need to log in to access this feature";
    if (error?.status === 403) return "You don't have permission to access this feature";
    if (error?.status === 404) return "The requested resource was not found";
    if (error?.status === 429) return "Too many requests. Please wait a moment and try again";
    if (error?.status >= 500) return "Server error. Please try again later";
    return "An unexpected error occurred";
  };

  return (
    <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
      <AlertDescription className="text-red-800 dark:text-red-200">
        <div className="flex items-center justify-between">
          <span>{getErrorMessage(error)}</span>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}