// The learner's own page: how many characters, words and sentences they have met, a year of
// activity, and a way into the memory palace. Derived from the cached progress, so it works
// offline.
import { useQuery } from "@tanstack/react-query";
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
import { profileQueryOptions } from "../offline/queries";
import { useSyncStatus } from "../offline/sync";
import { DitherGradient } from "./dither-kit/gradient";
import { Page, PageHeader, SectionHead, Status } from "./ui/layout";

const WEEKS = 52;
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });
const keyDensities = [0, 0.25, 0.5, 0.75, 1];

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

/** One column per week, newest on the right; on a phone it scrolls, opening at this week. */
function ActivityGraph({ weeks }: { weeks: ActivityDay[][] }) {
  const busiest = Math.max(...weeks.flat().map((day) => day.count));
  return (
    <div className="dx-activity">
      <div className="dx-activity-grid">
        <div aria-hidden="true" className="dx-activity-months">
          {weeks.map((week, index) => {
            const month = week[0]?.date.getMonth();
            const starts =
              index > 0 && month !== weeks[index - 1]?.[0]?.date.getMonth();
            return (
              <span key={week[0]?.key}>
                {starts && week[0]
                  ? monthFormat.format(week[0].date).toLowerCase()
                  : null}
              </span>
            );
          })}
        </div>
        <div className="dx-activity-weeks">
          {weeks.map((week) => (
            <div className="dx-activity-week" key={week[0]?.key}>
              {week.map((day) => (
                <i
                  data-future={day.future}
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
  const profile = useQuery(profileQueryOptions);
  const status = useSyncStatus();
  const who =
    status.signedIn && status.learner ? status.learner.email : "this device";

  if (!profile.data) {
    return (
      <Page head={<PageHeader title="profile" />}>
        <Status loading title="opening your profile" />
      </Page>
    );
  }
  return (
    <Page
      head={
        <PageHeader meta={<Link to="/settings">{who}</Link>} title="profile" />
      }
    >
      <Profile data={profile.data} />
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
      <div className="dx-scores">
        {tracks.map((track, index) => {
          const count = added[index] ?? 0;
          return (
            <p key={track.id}>
              <b className="dx-score">{track.learned + track.learning}</b>
              <span>{track.label}</span>
              <small data-added={count > 0}>
                {count ? `+${count} this week` : "none this week"}
              </small>
            </p>
          );
        })}
      </div>
      <SectionHead className="dx-pro-group" label="activity">
        <span aria-hidden="true" className="dx-activity-key">
          less
          {keyDensities.map((density) => (
            <i key={density}>
              <Cell density={density} />
            </i>
          ))}
          more
        </span>
      </SectionHead>
      <ActivityGraph weeks={weeks} />
      <p className="dx-pro-facts">
        <span>
          <b className="dx-pro-num">{streaks.current}</b> day streak
        </span>
        <span>
          <b className="dx-pro-num">{streaks.longest}</b> longest
        </span>
        <span>
          <b className="dx-pro-num">{streaks.activeDays}</b> days learning
        </span>
      </p>
      <Link className="dx-pro-row" to="/profile/palace">
        <span className="dx-pro-name">memory palace</span>
        <span>
          <b className="dx-pro-num">{palace.named}</b>/{palace.total} named
          <ChevronRight aria-hidden="true" size={15} />
        </span>
      </Link>
    </>
  );
}
