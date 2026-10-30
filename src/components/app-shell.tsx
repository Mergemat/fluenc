// Every route sits in the pull-to-refresh scroller. Study routes (/lessons, /review, /reading) get a stage
// exactly the scroller's height, so they never scroll. Older pages use the shared colour tokens.
// Desktop gets a sidebar (navigation, course progress, profile, settings) so pages keep the full height;
// tablets get a top bar and phones a tab bar.
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
import { cn } from "../lib/utils";
import {
  type SyncAttention,
  syncAttention,
  useSyncStatus,
} from "../progress/sync";
import { useProfile } from "../progress/views";
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

/** The frame of a full-screen view: the app below, the welcome reel on its own. */
export const shell =
  "flex h-dvh flex-col overflow-hidden pt-safe-top font-sans features-ss01 text-foreground antialiased bg-background max-md:pt-safe-header";

/** Fluenc's name beside its mark. */
export const brand =
  "flex items-center gap-2.5 font-mono font-semibold text-xl text-foreground leading-none tracking-snug type-reset lg:h-8 lg:px-2.5";

/** A square bordered icon link; on desktop the corner links become sidebar rows. */
export const iconButton =
  "grid size-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground max-md:ml-auto max-md:size-8";

/** The due-review count on the review tab. */
const badge =
  "box-border h-4 min-w-5 rounded-sm bg-primary px-1 text-center type-micro text-primary-foreground leading-4";

/** How far through the course the learner is, learned and learning; shown in the desktop sidebar. */
function CourseProgress() {
  const meters = useProfile().tracks.filter(
    (track) => track.id === "characters" || track.id === "words"
  );
  return (
    <Link
      aria-label="Course progress"
      className="group/course mt-auto hidden gap-4 border-border border-t px-3 py-3.5 lg:grid"
      to="/profile"
    >
      {meters.map((meter) => (
        <div className="grid gap-2" key={meter.id}>
          <p className="type-label m-0 flex items-baseline justify-between text-muted-foreground group-hover/course:text-foreground">
            <span>{meter.label}</span>
            <b className="font-medium text-foreground tabular-nums">
              {meter.learned + meter.learning}
              <small className="text-faint-foreground text-xs">
                /{meter.total}
              </small>
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

const markTones: Record<SyncAttention, string> = {
  "signed-out": "bg-orange",
  error: "bg-red",
  waiting: "bg-faint-foreground",
};

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
      className={cn(
        "absolute top-1 right-1 size-1.5 rounded-xs lg:static lg:ml-auto",
        markTones[attention]
      )}
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
    pathname.startsWith("/lessons") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/reading");
  // Study routes get a stage exactly the scroller's height; other pages scroll as usual.
  const page = fixed ? (
    <div className="flex h-full flex-col *:min-h-0 *:flex-1">{children}</div>
  ) : (
    children
  );
  // dither-kit paints its canvases in effects, so server HTML has none of them. Hold the shell
  // until hydration: children's effects (the canvas paints) run before this one flips it on.
  const hydrated = useHydrated();

  return (
    <div
      className={cn(
        shell,
        "group/shell lg:grid lg:grid-cols-shell lg:grid-rows-shell"
      )}
      data-booting={hydrated ? undefined : true}
    >
      {hydrated ? null : (
        <span className="fixed inset-0 grid place-items-center text-muted-foreground">
          <PixelLoader label="Opening Fluenc" size={5} />
        </span>
      )}
      <header className="relative flex h-16 shrink-0 items-center gap-6 px-7 group-data-booting/shell:invisible max-md:h-12 max-md:pr-3.5 max-md:pl-4 lg:h-auto lg:min-h-0 lg:flex-col lg:items-stretch lg:gap-0 lg:border-border lg:border-r lg:px-3 lg:pt-5 lg:pb-4">
        <Link aria-label="Fluenc home" className={brand} to="/today">
          <BrandMark />
          <span>fluenc</span>
        </Link>
        <nav
          aria-label="Main"
          className="ml-auto flex gap-2 max-md:hidden lg:m-0 lg:mt-6 lg:flex-col lg:gap-0.5"
        >
          {navigation.map((item) => (
            <Link
              activeProps={{ "aria-current": "page" }}
              className="type-control relative isolate inline-flex h-8 items-center gap-2 overflow-hidden rounded-md border border-border current:border-blue px-3 current:text-foreground text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground lg:h-10 lg:rounded-lg lg:border-transparent lg:text-md lg:hover:not-current:border-transparent lg:hover:not-current:bg-card"
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
                  <span className="relative inline-flex gap-2 lg:flex-1 lg:items-center lg:gap-3">
                    <item.icon
                      aria-hidden="true"
                      className="hidden lg:block"
                      size={16}
                      strokeWidth={1.75}
                    />
                    {item.label}
                    {item.to === "/review" && due ? (
                      <b className={cn(badge, "lg:ml-auto")}>{due}</b>
                    ) : null}
                  </span>
                </>
              )}
            </Link>
          ))}
        </nav>
        <CourseProgress />
        {corner.map((item, index) => (
          <Link
            activeProps={{ "aria-current": "page" }}
            aria-label={item.label}
            className={cn(
              iconButton,
              "relative isolate overflow-hidden current:border-blue current:text-foreground",
              "lg:type-control lg:flex lg:h-10 lg:w-auto lg:justify-start lg:gap-3 lg:rounded-lg lg:border-transparent lg:px-3 lg:text-md lg:hover:not-current:border-transparent lg:hover:not-current:bg-card",
              index > 0 && "max-md:-ml-3"
            )}
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
                <item.icon className="relative" size={16} strokeWidth={1.75} />
                <span className="relative hidden lg:block">{item.label}</span>
                {item.to === "/settings" ? <SyncMark /> : null}
              </>
            )}
          </Link>
        ))}
        <Rule className="absolute inset-x-0 bottom-0 h-0.5 lg:hidden" />
      </header>
      <main
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden *:min-h-0 *:flex-1 group-data-booting/shell:invisible"
        data-fixed={fixed}
      >
        <AppScroll pathname={pathname}>{page}</AppScroll>
      </main>
      <nav
        aria-label="Main tabs"
        className="relative hidden shrink-0 gap-1 px-1.5 pt-1.5 pb-safe-tabbar group-data-booting/shell:invisible max-md:flex"
      >
        <Rule className="absolute inset-x-0 top-0 h-0.5" />
        {navigation.map((item) => (
          <Link
            activeProps={{ "aria-current": "page" }}
            className="type-micro relative flex min-w-0 flex-1 flex-col items-center gap-1.5 overflow-hidden rounded-lg pt-1.5 pb-1 current:text-foreground text-muted-foreground transition-colors"
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
                <span className="relative grid h-6 w-10 place-items-center rounded-md">
                  <item.icon size={17} strokeWidth={1.75} />
                  {item.to === "/review" && due ? (
                    <b className={cn(badge, "absolute -top-1 left-7")}>{due}</b>
                  ) : null}
                </span>
                <span className="relative">{item.label}</span>
              </>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
