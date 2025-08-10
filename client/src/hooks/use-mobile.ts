import { useState, useEffect } from "react";

// Enhanced mobile detection with better touch target and UX considerations
export function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setScreenSize({ width, height });
      setIsMobile(width < breakpoint);
      setOrientation(width < height ? "portrait" : "landscape");
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, [breakpoint]);

  return {
    isMobile,
    screenSize,
    orientation,
    isSmallScreen: screenSize.width < 640,
    isMediumScreen: screenSize.width >= 640 && screenSize.width < 1024,
    isLargeScreen: screenSize.width >= 1024,
  };
}

// Touch target size helpers
export const touchTargets = {
  // Minimum touch target sizes (44px x 44px recommended by Apple/Google)
  minimum: "min-w-[44px] min-h-[44px]",
  comfortable: "min-w-[48px] min-h-[48px]",
  large: "min-w-[56px] min-h-[56px]",
  
  // Touch-friendly spacing
  spacing: {
    tight: "gap-2",
    normal: "gap-3",
    comfortable: "gap-4",
    loose: "gap-6",
  },
  
  // Touch-friendly padding for interactive elements
  padding: {
    sm: "p-3",
    md: "p-4", 
    lg: "p-6",
  }
};

// Mobile-optimized class combinations
export const mobileOptimized = {
  button: `${touchTargets.comfortable} touch-manipulation`,
  input: `${touchTargets.comfortable} text-base`, // Prevents zoom on iOS
  card: "touch-manipulation",
  scrollArea: "overscroll-contain",
};

// Hook for handling mobile-specific interactions
export function useMobileInteractions() {
  const [isScrolling, setIsScrolling] = useState(false);
  const [lastTouchY, setLastTouchY] = useState(0);

  useEffect(() => {
    let scrollTimer: NodeJS.Timeout;

    const handleScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => setIsScrolling(false), 150);
    };

    const handleTouchStart = (e: TouchEvent) => {
      setLastTouchY(e.touches[0].clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const deltaY = lastTouchY - currentY;
      
      // Detect scroll direction for custom behaviors
      if (Math.abs(deltaY) > 5) {
        setIsScrolling(true);
      }
    };

    const handleTouchEnd = () => {
      setTimeout(() => setIsScrolling(false), 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      clearTimeout(scrollTimer);
    };
  }, [lastTouchY]);

  return {
    isScrolling,
  };
}

// Viewport helpers for mobile layouts
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    safeAreaTop: 0,
    safeAreaBottom: 0,
  });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        safeAreaTop: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top') || '0'),
        safeAreaBottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0'),
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  return viewport;
}