import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";

/** Query defaults tuned for a live incident console: data is pushed to us over
 *  the WebSocket, so polling stays off and refetch-on-focus is disabled. A 4xx
 *  is never retried (it is a real answer, e.g. the 409 approval gate). */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            staleTime: 5_000,
            gcTime: 5 * 60_000,
            retry: (attempt, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return attempt < 2;
            },
            retryDelay: (attempt) => Math.min(600 * 2 ** attempt, 4_000),
          },
          mutations: { retry: false },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
