import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import "./styles/tokens.css";
import "./styles/base.css";
import { ToastProvider } from "./components/ui";
import Landing from "./pages/Landing";
import Login from "./pages/Login";

const AppLayout = lazy(() => import("./pages/app/Layout"));
const Home = lazy(() => import("./pages/app/Home"));
const LibraryPage = lazy(() => import("./pages/app/Library"));
const Reader = lazy(() => import("./pages/app/Reader"));
const Highlights = lazy(() => import("./pages/app/Highlights"));
const Collections = lazy(() => import("./pages/app/Collections"));
const Spark = lazy(() => import("./pages/app/Spark"));
const Integrations = lazy(() => import("./pages/app/Integrations"));
const Settings = lazy(() => import("./pages/app/Settings"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="read/:id" element={<Reader />} />
              <Route path="highlights" element={<Highlights />} />
              <Route path="collections" element={<Collections />} />
              <Route path="collections/:id" element={<LibraryPage />} />
              <Route path="spark" element={<Spark />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);
