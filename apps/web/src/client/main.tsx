import { StrictMode, Suspense, lazy, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/tokens.css";
import "./styles/base.css";
import { ToastProvider } from "./components/ui";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import { ConsentBanner } from "./components/Consent";
import { initAnalytics } from "./lib/analytics";

const pageLoaders: Array<() => Promise<unknown>> = [];
function page<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  pageLoaders.push(load);
  return lazy(load);
}
// Every page downloads once the shell is up so a first click renders like a revisit; a failed prefetch just retries on click.
const prefetchPages = () => setTimeout(() => pageLoaders.forEach((load) => load().catch(() => {})), 300);
const AppLayout = lazy(() => import("./pages/app/Layout").then((layout) => { prefetchPages(); return layout; }));
const Home = page(() => import("./pages/app/Home"));
const LibraryPage = page(() => import("./pages/app/Library"));
const Reader = page(() => import("./pages/app/Reader"));
const Highlights = page(() => import("./pages/app/Highlights"));
const Collections = page(() => import("./pages/app/Collections"));
const Spark = page(() => import("./pages/app/Spark"));
const Integrations = page(() => import("./pages/app/Integrations"));
const Settings = page(() => import("./pages/app/Settings"));
const Radar = page(() => import("./pages/app/Radar"));
const Analytics = page(() => import("./pages/app/Analytics"));
import NotFound from "./pages/NotFound";
const Upgrade = page(() => import("./pages/app/Upgrade"));
const Ask = page(() => import("./pages/app/Ask"));
const Following = page(() => import("./pages/app/Following"));
const Recall = page(() => import("./pages/app/Recall"));
const Agents = page(() => import("./pages/app/Agents"));
const ExtensionPage = page(() => import("./pages/app/ExtensionPage"));
const Owner = page(() => import("./pages/app/Owner"));
import { ProGate } from "./pages/app/ProGate";

initAnalytics();

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
              <Route path="recall" element={<Recall />} />
              <Route path="collections" element={<Collections />} />
              <Route path="collections/:id" element={<LibraryPage />} />
              <Route path="spark" element={<ProGate feature="spark"><Spark /></ProGate>} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="settings" element={<Settings />} />
              <Route path="radar" element={<ProGate feature="radar"><Radar /></ProGate>} />
              <Route path="analytics" element={<ProGate feature="analytics"><Analytics /></ProGate>} />
              <Route path="upgrade" element={<Upgrade />} />
              <Route path="ask" element={<Ask />} />
              <Route path="following" element={<Following />} />
              <Route path="agents" element={<Agents />} />
              <Route path="extension" element={<ExtensionPage />} />
              <Route path="owner" element={<Owner />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ConsentBanner />
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);
