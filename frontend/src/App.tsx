import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Dashboard, Review, Applications, Analytics, Resumes, Settings, Apps } from "@/pages";
import { WebSocketInit } from "@/components/WebSocketInit";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WebSocketInit />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/review" element={<Review />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/resumes" element={<Resumes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/apps" element={<Apps />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
