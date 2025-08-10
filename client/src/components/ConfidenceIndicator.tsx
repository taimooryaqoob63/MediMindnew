import { CheckCircle, AlertTriangle, Info, HelpCircle, Timer, Database, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface ConfidenceIndicatorProps {
  confidence?: number;
  sources?: number;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "badge" | "progress" | "icon";
}

export default function ConfidenceIndicator({ 
  confidence = 0, 
  sources = 0,
  showDetails = true,
  size = "md",
  variant = "badge"
}: ConfidenceIndicatorProps) {
  
  // Normalize confidence to 0-100 range
  const normalizedConfidence = Math.max(0, Math.min(100, confidence * 100));
  
  const getConfidenceLevel = (conf: number) => {
    if (conf >= 90) return { level: "high", color: "green", icon: CheckCircle };
    if (conf >= 70) return { level: "medium", color: "yellow", icon: Info };
    if (conf >= 50) return { level: "low", color: "orange", icon: AlertTriangle };
    return { level: "very-low", color: "red", icon: HelpCircle };
  };

  const { level, color, icon: Icon } = getConfidenceLevel(normalizedConfidence);

  const getColorClasses = (colorName: string) => {
    switch (colorName) {
      case "green":
        return {
          badge: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
          progress: "bg-green-100 dark:bg-green-900/20",
          progressBar: "bg-green-500",
          icon: "text-green-600 dark:text-green-400"
        };
      case "yellow":
        return {
          badge: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
          progress: "bg-yellow-100 dark:bg-yellow-900/20",
          progressBar: "bg-yellow-500",
          icon: "text-yellow-600 dark:text-yellow-400"
        };
      case "orange":
        return {
          badge: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
          progress: "bg-orange-100 dark:bg-orange-900/20",
          progressBar: "bg-orange-500",
          icon: "text-orange-600 dark:text-orange-400"
        };
      default:
        return {
          badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
          progress: "bg-red-100 dark:bg-red-900/20",
          progressBar: "bg-red-500",
          icon: "text-red-600 dark:text-red-400"
        };
    }
  };

  const colors = getColorClasses(color);

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return { icon: "w-3 h-3", text: "text-xs", badge: "text-xs px-2 py-0.5", progress: "h-1" };
      case "lg":
        return { icon: "w-5 h-5", text: "text-sm", badge: "text-sm px-3 py-1", progress: "h-3" };
      default:
        return { icon: "w-4 h-4", text: "text-xs", badge: "text-xs px-2 py-1", progress: "h-2" };
    }
  };

  const sizeClasses = getSizeClasses();

  const getConfidenceText = () => {
    switch (level) {
      case "high":
        return "High confidence";
      case "medium":
        return "Medium confidence";
      case "low":
        return "Low confidence";
      default:
        return "Very low confidence";
    }
  };

  const getTooltipContent = () => {
    let content = `AI Confidence: ${normalizedConfidence.toFixed(0)}%\n`;
    content += `Based on ${sources} source${sources !== 1 ? 's' : ''}\n\n`;
    
    switch (level) {
      case "high":
        content += "This response is well-supported by reliable sources.";
        break;
      case "medium":
        content += "This response has good support but may benefit from additional verification.";
        break;
      case "low":
        content += "This response has limited support. Please verify with additional sources.";
        break;
      default:
        content += "This response has very limited support. Please use caution and verify independently.";
    }
    
    return content;
  };

  if (variant === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center cursor-help">
            <Icon className={`${sizeClasses.icon} ${colors.icon}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="whitespace-pre-line">
            {getTooltipContent()}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "progress") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full space-y-1 cursor-help">
            <div className="flex justify-between items-center">
              <span className={`${sizeClasses.text} text-gray-600 dark:text-gray-400`}>
                Confidence
              </span>
              <span className={`${sizeClasses.text} font-medium`}>
                {normalizedConfidence.toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={normalizedConfidence} 
              className={`${sizeClasses.progress} ${colors.progress}`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="whitespace-pre-line">
            {getTooltipContent()}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Default badge variant
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`${colors.badge} ${sizeClasses.badge} cursor-help inline-flex items-center gap-1`}
        >
          <Icon className={sizeClasses.icon} />
          {showDetails ? (
            <span>
              {getConfidenceText()} ({normalizedConfidence.toFixed(0)}%)
            </span>
          ) : (
            <span>{normalizedConfidence.toFixed(0)}%</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="whitespace-pre-line">
          {getTooltipContent()}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Compact version for inline use
interface CompactConfidenceProps {
  confidence?: number;
  sources?: number;
}

export function CompactConfidence({ confidence = 0, sources = 0 }: CompactConfidenceProps) {
  const normalizedConfidence = Math.max(0, Math.min(100, confidence * 100));
  
  return (
    <div className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      <ConfidenceIndicator 
        confidence={confidence} 
        sources={sources} 
        variant="icon" 
        size="sm" 
      />
      <span>{normalizedConfidence.toFixed(0)}%</span>
      {sources > 0 && (
        <span className="text-gray-400">
          • {sources} source{sources !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

// Response quality indicator
interface ResponseQualityProps {
  confidence?: number;
  sources?: number;
  responseTime?: number;
  usedRAG?: boolean;
}

export function ResponseQuality({ 
  confidence = 0, 
  sources = 0, 
  responseTime,
  usedRAG = false 
}: ResponseQualityProps) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
      <CompactConfidence confidence={confidence} sources={sources} />
      
      {responseTime && (
        <span>
          {responseTime < 1000 ? `${responseTime}ms` : `${(responseTime / 1000).toFixed(1)}s`}
        </span>
      )}
      
      {usedRAG && (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
          Evidence-based
        </Badge>
      )}
    </div>
  );
}