// Every route sits in the pull-to-refresh scroller. Study routes (/lessons, /review) get a stage
// exactly the scroller's height, so they never scroll. Older pages use the shared colour tokens.
// Desktop gets a sidebar (navigation, course progress, profile, settings) so pages keep the full height;
// tablets get a top bar and phones a tab bar.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Brain,
  CircleUserRound,
  GraduationCap,
  LibraryBig,
  Settings,
  Sun,
} from "lucide-react";
import type { ReactNode } from "react";
import { useHydrated } from "../hooks/use-hydrated";

import type { DashboardData } from "../lib/learner-views";
import { profileQueryOptions } from "../offline/queries";
import {
  type SyncAttention,
  syncAttention,
  useSyncStatus,
} from "../offline/sync";
import { AppScroll } from "./app-scroll";
import { DitherGradient } from "./dither-kit/gradient";
import { BrandMark } from "./ui/brand-mark";
import { PixelLoader, Rule } from "./ui/dither";
import { SplitMeter } from "./ui/split-meter";

// Today is the home page; the activities follow in the order Today suggests them.
const navigation = [
  { to: "/today", label: "today", icon: Sun },
  { to: "/review", label: "review", icon: Brain },
  { to: "/lessons", label: "learn", icon: GraduationCap },
  { to: "/reading", label: "read", icon: BookOpen },
  { to: "/library", label: "library", icon: LibraryBig },
] as const;

/** Profile and settings sit apart from the activities: under the sidebar, or as icons up top. */
const corner = [
  { to: "/profile", label: "profile", icon: CircleUserRound },
  { to: "/settings", label: "settings", icon: Settings },
] as const;

/** How far through the course the learner is, learned and learning; shown in the desktop sidebar. */
function CourseProgress() {
  const { data } = useQuery(profileQueryOptions);
  const meters = data?.tracks.filter(
    (track) => track.id === "characters" || track.id === "words"
  );
  return (
    <Link aria-label="Course progress" className="dx-course" to="/profile">
      {meters?.map((meter) => (
        <div className="dx-course-meter" key={meter.id}>
          <p>
            <span>{meter.label}</span>
            <b>
              {meter.learned + meter.learning}
              <small>/{meter.total}</small>
            </b>
          </p>
          <SplitMeter
            label={`${meter.label} learned`}
            learned={meter.learned}
            learning={meter.learning}
            text={`${meter.learned} learned, ${meter.learning} learning`}
            total={meter.total}
          />
        </div>
      ))}
    </Link>
  );
}

const attentionLabels: Record<SyncAttention, string> = {
  "signed-out": "signed out · sign in to keep syncing",
  error: "sync failed · retrying",
  waiting: "changes wait for a connection",
};

/** Marks the settings link when sync needs the learner; otherwise nothing shows. */
function SyncMark() {
  const attention = syncAttention(useSyncStatus());
  return attention ? (
    <i
      aria-label={attentionLabels[attention]}
      className="dx-sync-mark"
      data-tone={attention}
      role="img"
      title={attentionLabels[attention]}
    />
  ) : null;
}

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
    <div className="dx-shell" data-hydrated={hydrated}>
      {hydrated ? null : (
        <span className="dx-boot">
          <PixelLoader label="Opening Fluenc" size={5} />
        </span>
      )}
      <header className="dx-top">
        <Link aria-label="Fluenc home" className="dx-brand" to="/today">
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
                    <item.icon
                      aria-hidden="true"
                      className="dx-nav-icon"
                      size={16}
                      strokeWidth={1.75}
                    />
                    {item.label}
                    {item.to === "/review" && due ? <b>{due}</b> : null}
                  </span>
                </>
              )}
            </Link>
          ))}
        </nav>
        <CourseProgress />
        {corner.map((item) => (
          <Link
            activeProps={{ "aria-current": "page" }}
            aria-label={item.label}
            className="dx-icon-button dx-settings-link"
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
                <item.icon size={16} strokeWidth={1.75} />
                <span className="dx-nav-label">{item.label}</span>
                {item.to === "/settings" ? <SyncMark /> : null}
              </>
            )}
          </Link>
        ))}
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
  );
}
