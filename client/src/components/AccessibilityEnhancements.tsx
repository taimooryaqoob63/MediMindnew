import { useState, useEffect, useRef } from "react";
import { Keyboard, Eye, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

// Accessibility settings interface
interface A11ySettings {
  highContrast: boolean;
  reduceMotion: boolean;
  largerText: boolean;
  keyboardNavigation: boolean;
  screenReaderMode: boolean;
  focusIndicators: boolean;
  textSize: number;
}

// Keyboard navigation hook
export function useKeyboardNavigation() {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  return { isKeyboardUser };
}

// Skip links for keyboard navigation
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-2 left-2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className="fixed top-2 left-32 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to navigation
      </a>
    </div>
  );
}

// Focus trap for modals and dialogs
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Trigger close callback if provided
        const event = new CustomEvent("escapekeydown");
        container.dispatchEvent(event);
      }
    };

    container.addEventListener("keydown", handleTabKey);
    container.addEventListener("keydown", handleEscapeKey);
    
    // Focus first element when activated
    firstElement?.focus();

    return () => {
      container.removeEventListener("keydown", handleTabKey);
      container.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isActive]);

  return containerRef;
}

// Accessibility settings panel
interface A11yPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccessibilityPanel({ isOpen, onClose }: A11yPanelProps) {
  const [settings, setSettings] = useState<A11ySettings>({
    highContrast: false,
    reduceMotion: false,
    largerText: false,
    keyboardNavigation: true,
    screenReaderMode: false,
    focusIndicators: true,
    textSize: 100,
  });

  const focusTrapRef = useFocusTrap(isOpen);

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem("medimind-a11y-settings");
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    // Apply settings to document
    const root = document.documentElement;
    
    if (settings.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }

    if (settings.reduceMotion) {
      root.classList.add("reduce-motion");
    } else {
      root.classList.remove("reduce-motion");
    }

    if (settings.largerText) {
      root.classList.add("larger-text");
    } else {
      root.classList.remove("larger-text");
    }

    if (settings.focusIndicators) {
      root.classList.add("enhanced-focus");
    } else {
      root.classList.remove("enhanced-focus");
    }

    root.style.setProperty("--text-scale", `${settings.textSize}%`);

    // Save to localStorage
    localStorage.setItem("medimind-a11y-settings", JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key: keyof A11ySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    const defaultSettings: A11ySettings = {
      highContrast: false,
      reduceMotion: false,
      largerText: false,
      keyboardNavigation: true,
      screenReaderMode: false,
      focusIndicators: true,
      textSize: 100,
    };
    setSettings(defaultSettings);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card 
        ref={focusTrapRef}
        className="w-full max-w-md bg-white dark:bg-gray-900 shadow-xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onClose();
          }
        }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Accessibility Settings
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="high-contrast" className="text-sm font-medium">
                High Contrast
              </label>
              <p className="text-xs text-gray-500">
                Increase contrast for better visibility
              </p>
            </div>
            <Switch
              id="high-contrast"
              checked={settings.highContrast}
              onCheckedChange={(checked) => updateSetting("highContrast", checked)}
            />
          </div>

          {/* Reduce Motion */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="reduce-motion" className="text-sm font-medium">
                Reduce Motion
              </label>
              <p className="text-xs text-gray-500">
                Minimize animations and transitions
              </p>
            </div>
            <Switch
              id="reduce-motion"
              checked={settings.reduceMotion}
              onCheckedChange={(checked) => updateSetting("reduceMotion", checked)}
            />
          </div>

          {/* Enhanced Focus */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="focus-indicators" className="text-sm font-medium">
                Enhanced Focus
              </label>
              <p className="text-xs text-gray-500">
                Show clearer focus indicators
              </p>
            </div>
            <Switch
              id="focus-indicators"
              checked={settings.focusIndicators}
              onCheckedChange={(checked) => updateSetting("focusIndicators", checked)}
            />
          </div>

          {/* Text Size */}
          <div className="space-y-2">
            <label htmlFor="text-size" className="text-sm font-medium">
              Text Size: {settings.textSize}%
            </label>
            <Slider
              id="text-size"
              min={75}
              max={150}
              step={25}
              value={[settings.textSize]}
              onValueChange={([value]) => updateSetting("textSize", value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Smaller</span>
              <span>Normal</span>
              <span>Larger</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={resetSettings}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Announce important changes to screen readers
export function useAnnouncer() {
  const announcerRef = useRef<HTMLDivElement>(null);

  const announce = (message: string, priority: "polite" | "assertive" = "polite") => {
    if (!announcerRef.current) return;

    const announcement = document.createElement("div");
    announcement.textContent = message;
    announcement.setAttribute("aria-live", priority);
    announcement.className = "sr-only";

    announcerRef.current.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      if (announcerRef.current?.contains(announcement)) {
        announcerRef.current.removeChild(announcement);
      }
    }, 1000);
  };

  const Announcer = () => (
    <div
      ref={announcerRef}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );

  return { announce, Announcer };
}

// Alt text generator for images
export function generateAltText(imageSrc: string, context?: string): string {
  // Extract meaningful information from image path/name
  const filename = imageSrc.split('/').pop()?.split('.')[0] || 'image';
  
  // Common patterns
  if (filename.includes('logo')) {
    return `${context || 'MediMind AI'} logo`;
  }
  
  if (filename.includes('diagram') || filename.includes('chart')) {
    return `${context || 'Medical'} diagram showing key information`;
  }
  
  if (filename.includes('photo') || filename.includes('img')) {
    return `${context || 'Healthcare'} related image`;
  }
  
  if (filename.includes('icon')) {
    return `${context || 'Interface'} icon`;
  }
  
  // Fallback
  return context ? `${context} image` : 'Image';
}

// Accessible image component
interface AccessibleImageProps {
  src: string;
  alt?: string;
  context?: string;
  decorative?: boolean;
  className?: string;
}

export function AccessibleImage({ 
  src, 
  alt, 
  context, 
  decorative = false, 
  className 
}: AccessibleImageProps) {
  const generatedAlt = alt || (decorative ? "" : generateAltText(src, context));
  
  return (
    <img
      src={src}
      alt={generatedAlt}
      className={className}
      role={decorative ? "presentation" : undefined}
      aria-hidden={decorative}
    />
  );
}