import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Dashboard, Review, Applications, Analytics, Resumes, Settings, Apps } from "@/pages";
import { WebSocketInit } from "@/components/WebSocketInit";
import { ErrorBoundary, ToastContainer } from "@/components/common";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <p className="text-5xl font-bold text-text-secondary">404</p>
      <p className="text-text-secondary mt-2">Page not found</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
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
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <ToastContainer />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}