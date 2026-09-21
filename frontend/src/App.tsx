import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SkeletonCard } from "@/components/ui/Skeleton";

/** Route-level code splitting: pages load on demand. */
const Home = lazy(() => import("@/pages/Home"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Incidents = lazy(() => import("@/pages/Incidents"));
const Investigate = lazy(() => import("@/pages/Investigate"));
const Services = lazy(() => import("@/pages/Services"));
const Activity = lazy(() => import("@/pages/Activity"));
const History = lazy(() => import("@/pages/History"));
const Settings = lazy(() => import("@/pages/Settings"));
const Inspector = lazy(() => import("@/pages/Inspector"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function RouteFallback() {
  return (
    <div className="space-y-4 py-2">
      <SkeletonCard />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Home Overview Page */}
        <Route
          index
          element={
            <Suspense fallback={<RouteFallback />}>
              <Home />
            </Suspense>
          }
        />

        {/* Command Center */}
        <Route
          path="dashboard"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route path="command" element={<Navigate to="/dashboard" replace />} />

        {/* Incidents & Investigation */}
        <Route
          path="incidents"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Incidents />
            </Suspense>
          }
        />
        <Route
          path="incidents/:id"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Investigate />
            </Suspense>
          }
        />
        <Route
          path="investigate"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Investigate />
            </Suspense>
          }
        />

        {/* Services & Monitoring */}
        <Route
          path="services"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Services />
            </Suspense>
          }
        />
        <Route
          path="activity"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Activity />
            </Suspense>
          }
        />
        <Route
          path="history"
          element={
            <Suspense fallback={<RouteFallback />}>
              <History />
            </Suspense>
          }
        />
        <Route
          path="reports"
          element={
            <Suspense fallback={<RouteFallback />}>
              <History />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Settings />
            </Suspense>
          }
        />
        <Route
          path="inspector"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Inspector />
            </Suspense>
          }
        />
        <Route
          path="repositories"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Inspector />
            </Suspense>
          }
        />

        {/* 404 Fallback */}
        <Route
          path="*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <NotFound />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
