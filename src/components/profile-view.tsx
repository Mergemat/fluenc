// The learner's own page: how many characters, words and sentences they have met, a year of
// activity, and a way into the memory palace. Derived from the cached progress, so it works
// offline.
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";

import {
  type ActivityDay,
  activityCalendar,
  activityDensity,
  activityStreaks,
  countThisWeek,
  dateOfKey,
  dayKey,
} from "../lib/activity";
import type { ProfileData } from "../lib/profile";
import { cn } from "../lib/utils";
import { useSyncStatus } from "../progress/sync";
import { useProfile } from "../progress/views";
import { DitherGradient } from "./dither-kit/gradient";
import { Page, PageHeader, SectionHead } from "./ui/layout";

const WEEKS = 52;
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });
const keyDensities = [0, 0.25, 0.5, 0.75, 1];
// A day's square; each hosts a dither-kit gradient.
const dayCell = "relative block overflow-hidden rounded-xs";
const num = "font-medium text-foreground";

/** A day's square: a faint grey base, and green dither as dense and bright as the day was busy. */
function Cell({ density }: { density: number }) {
  return (
    <>
      <DitherGradient cell={1} direction="up" from="grey" opacity={0.22} />
      {density ? (
        <DitherGradient
          cell={1}
          density={density}
          from="green"
          opacity={0.55 + 0.45 * density}
        />
      ) : null}
    </>
  );
}

/**
 * One column per week, newest on the right. From `md` the weeks share the width; on a phone it
 * scrolls, opening at this week.
 */
function ActivityGraph({ weeks }: { weeks: ActivityDay[][] }) {
  const busiest = Math.max(...weeks.flat().map((day) => day.count));
  return (
    <div className="scrollbar-none flex flex-row-reverse overflow-x-auto">
      <div className="grid flex-none gap-1.5 md:flex-1">
        <div
          aria-hidden="true"
          className="type-micro flex h-3 whitespace-nowrap text-muted-foreground md:gap-1"
        >
          {weeks.map((week, index) => {
            const month = week[0]?.date.getMonth();
            const starts =
              index > 0 && month !== weeks[index - 1]?.[0]?.date.getMonth();
            return (
              <span
                className="w-5 flex-none max-xs:w-3.5 md:w-auto md:flex-1 md:basis-0"
                key={week[0]?.key}
              >
                {starts && week[0]
                  ? monthFormat.format(week[0].date).toLowerCase()
                  : null}
              </span>
            );
          })}
        </div>
        <div className="flex gap-1">
          {weeks.map((week) => (
            <div className="grid gap-1 md:flex-1" key={week[0]?.key}>
              {week.map((day) => (
                <i
                  className={cn(
                    dayCell,
                    "size-4 max-xs:size-3 md:aspect-square md:size-auto",
                    day.future && "invisible"
                  )}
                  key={day.key}
                  title={`${day.key} · ${day.count} new`}
                >
                  {day.future ? null : (
                    <Cell density={activityDensity(day.count, busiest)} />
                  )}
                </i>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileView() {
  const profile = useProfile();
  const status = useSyncStatus();
  const who =
    status.signedIn && status.learner ? status.learner.email : "this device";

  return (
    <Page
      head={
        <PageHeader meta={<Link to="/settings">{who}</Link>} title="profile" />
      }
    >
      <Profile data={profile} />
    </Page>
  );
}

function Profile({ data }: { data: ProfileData }) {
  const { tracks, introductions, palace } = data;
  // Worked out once per day and per change in progress, not on every render.
  const today = dayKey(new Date());
  const { weeks, streaks, added } = useMemo(() => {
    const now = dateOfKey(today);
    return {
      weeks: activityCalendar(introductions, now, WEEKS),
      streaks: activityStreaks(introductions, now),
      added: tracks.map((track) => countThisWeek(track.introducedAt, now)),
    };
  }, [introductions, tracks, today]);
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {tracks.map((track, index) => {
          const count = added[index] ?? 0;
          return (
            <p className="m-0 grid min-w-0 gap-1" key={track.id}>
              <b className="type-display text-foreground text-score tabular-nums leading-none tracking-tighter">
                {track.learned + track.learning}
              </b>
              <span className="type-heading text-foreground">
                {track.label}
              </span>
              <small
                className={cn(
                  "type-label",
                  count > 0 ? "text-green" : "text-muted-foreground"
                )}
              >
                {count ? `+${count} this week` : "none this week"}
              </small>
            </p>
          );
        })}
      </div>
      <SectionHead className="mt-12" label="activity">
        <span
          aria-hidden="true"
          className="type-micro inline-flex items-center gap-1 text-muted-foreground"
        >
          less
          {keyDensities.map((density) => (
            <i className={cn(dayCell, "size-2.5")} key={density}>
              <Cell density={density} />
            </i>
          ))}
          more
        </span>
      </SectionHead>
      <ActivityGraph weeks={weeks} />
      <p className="type-control mt-4 mb-9 flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
        <span>
          <b className={num}>{streaks.current}</b> day streak
        </span>
        <span>
          <b className={num}>{streaks.longest}</b> longest
        </span>
        <span>
          <b className={num}>{streaks.activeDays}</b> days learning
        </span>
      </p>
      <Link
        className="type-control flex min-h-14 items-center justify-between gap-4 py-3 text-muted-foreground tabular-nums hover:text-foreground"
        to="/profile/palace"
      >
        <span className="type-heading text-foreground">memory palace</span>
        <span className="inline-flex items-center gap-0.5">
          <span>
            <b className={num}>{palace.named}</b>/{palace.total} named
          </span>
          <ChevronRight aria-hidden="true" size={15} />
        </span>
      </Link>
    </>
  );
}
