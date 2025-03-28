import { useCallback, useEffect, useState } from "react";
import { ZodType } from "zod";

export function useData<T>(
  url: string,
  schema: ZodType<T, any, any>,
): {
  // TODO: any
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
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
  }, [url, schema, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
