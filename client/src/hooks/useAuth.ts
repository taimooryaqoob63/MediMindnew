import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle the case where user is null but request succeeded (not authenticated)
  const isAuthenticated = user !== null && user !== undefined;

  return {
    user: user || null,
    isLoading,
    isAuthenticated,
    error,
  };
}