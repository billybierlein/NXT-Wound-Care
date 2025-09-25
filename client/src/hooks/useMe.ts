import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface MeData {
  id: number;
  role: "admin" | "sales_rep";
  salesRepId: number | null;
}

export function useMe() {
  const [me, setMe] = useState<MeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchMe = async () => {
      try {
        const response = await apiRequest("GET", "/api/me");
        const result = await response.json();
        
        if (isMounted && result.ok) {
          setMe(result.data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching me data:", err);
          setError("Failed to fetch user data");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMe();

    return () => {
      isMounted = false;
    };
  }, []);

  const isAdmin = me?.role === "admin";
  const isSalesRep = me?.role === "sales_rep";

  return {
    me,
    isLoading,
    error,
    isAdmin,
    isSalesRep,
  };
}