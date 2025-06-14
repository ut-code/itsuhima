import { useCallback, useEffect, useState } from "react";
import type { ZodType, ZodTypeDef } from "zod";
import { API_ENDPOINT } from "./utils";

export function useData<O, I>(
  url: string | null,
  schema: ZodType<O, ZodTypeDef, I>,
): {
  // TODO: any
  data: O | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<O | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(url, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setData(schema.parse(data));
      } else {
        setData(null);
        setError("response not ok");
      }
    } catch (error) {
      console.error("useData error: ", error);
      setData(null);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url, schema]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useAuth(): { isAuthenticated: boolean | null } {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_ENDPOINT}/projects/mine`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        if (res.ok) {
          setIsAuthenticated(true);
        } else if (res.status === 401 || res.status === 403) {
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(false);
          console.error(`Unexpected response: ${res.status} ${res.statusText}`);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setIsAuthenticated(false);
        console.error("Auth check failed:", err);
      }
    };

    checkAuth();

    return () => controller.abort();
  }, []);

  return { isAuthenticated };
}
