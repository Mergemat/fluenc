// Every route sits in the pull-to-refresh scroller. Study routes (/lessons, /review) get a stage
// exactly the scroller's height, so they never scroll. Older pages use the shared colour tokens.
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Brain,
  Clapperboard,
  GraduationCap,
  LibraryBig,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { useHydrated } from "../hooks/use-hydrated";

import type { DashboardData } from "../lib/learner-views";
import { AppScroll } from "./app-scroll";
import { DitherGradient } from "./dither-kit/gradient";
import { BrandMark } from "./ui/brand-mark";
import { PixelLoader, Rule } from "./ui/dither";
import { ToastProvider } from "./ui/toast";

// Learn is the home page and sits in the middle of the bar.
const navigation = [
  { to: "/reading", label: "read", icon: BookOpen },
  { to: "/review", label: "review", icon: Brain },
  { to: "/lessons", label: "learn", icon: GraduationCap },
  { to: "/library", label: "library", icon: LibraryBig },
  { to: "/palace", label: "palace", icon: Clapperboard },
] as const;

export function AppShell({
  data,
  pathname,
  children,
}: {
  data: DashboardData;
  pathname: string;
  children: ReactNode;
}) {
  const due = data.reviewQueue.length;
  const fixed =
    pathname.startsWith("/lessons") || pathname.startsWith("/review");
  // Study routes get a stage exactly the scroller's height; other pages scroll as usual.
  const page = fixed ? <div className="dx-stage">{children}</div> : children;
  // dither-kit paints its canvases in effects, so server HTML has none of them. Hold the shell
  // until hydration: children's effects (the canvas paints) run before this one flips it on.
  const hydrated = useHydrated();

  return (
    <ToastProvider>
      <div className="dx-shell" data-hydrated={hydrated}>
        {hydrated ? null : (
          <span className="dx-boot">
            <PixelLoader label="Opening Fluenc" size={5} />
          </span>
        )}
        <header className="dx-top">
          <Link aria-label="Fluenc home" className="dx-brand" to="/lessons">
            <BrandMark />
            <span>fluenc</span>
          </Link>
          <nav aria-label="Main" className="dx-nav">
            {navigation.map((item) => (
              <Link
                activeProps={{ "aria-current": "page" }}
                className="dx-nav-chip"
                key={item.to}
                to={item.to}
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <DitherGradient
                        cell={2}
                        direction="up"
                        from="blue"
                        opacity={0.45}
                      />
                    ) : null}
                    <span>
                      {item.label}
                      {item.to === "/review" && due ? <b>{due}</b> : null}
                    </span>
                  </>
                )}
              </Link>
            ))}
          </nav>
          <Link
            activeProps={{ "aria-current": "page" }}
            aria-label="Settings"
            className="dx-icon-button"
            to="/settings"
          >
            <Settings size={16} />
          </Link>
          <Rule className="dx-edge dx-edge-bottom" />
        </header>
        <main className="dx-main" data-fixed={fixed}>
          <AppScroll pathname={pathname}>{page}</AppScroll>
        </main>
        <nav aria-label="Main tabs" className="dx-tabbar">
          <Rule className="dx-edge dx-edge-top" />
          {navigation.map((item) => (
            <Link
              activeProps={{ "aria-current": "page" }}
              key={item.to}
              to={item.to}
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <DitherGradient
                      cell={2}
                      direction="up"
                      from="blue"
                      opacity={0.35}
                    />
                  ) : null}
                  <span className="dx-tab-icon">
                    <item.icon size={17} strokeWidth={1.75} />
                    {item.to === "/review" && due ? <b>{due}</b> : null}
                  </span>
                  <span className="dx-tab-label">{item.label}</span>
                </>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}
