import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/auth/AuthProvider";
import { RedirectIfAuthed, RequireAuth } from "@/auth/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { WorkbookListPage } from "@/pages/WorkbookListPage";
import { WorkbookViewPage } from "@/pages/WorkbookViewPage";
import { MarketsPage } from "@/pages/MarketsPage";
import { StockDetailPage } from "@/pages/StockDetailPage";
import { BacktestDetailPage } from "@/pages/BacktestDetailPage";
import { RunDetailPage } from "@/pages/RunDetailPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <LoginPage />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuthed>
                  <RegisterPage />
                </RedirectIfAuthed>
              }
            />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route path="/workbooks" element={<WorkbookListPage />} />
                <Route path="/workbooks/:workbookId" element={<WorkbookViewPage />} />
                <Route
                  path="/workbooks/:workbookId/backtests/:backtestId"
                  element={<BacktestDetailPage />}
                />
                <Route path="/workbooks/:workbookId/runs/:runId" element={<RunDetailPage />} />
                <Route path="/markets" element={<MarketsPage />} />
                <Route path="/markets/:ticker" element={<StockDetailPage />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/workbooks" replace />} />
            <Route path="*" element={<Navigate to="/workbooks" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
