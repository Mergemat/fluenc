// The learner's own page: how many characters, words and sentences they have met, a year of
// activity, and a way into the memory palace. Derived from the cached progress, so it works
// offline.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import {
  type ActivityDay,
  activityCalendar,
  activityFill,
  activityStreaks,
  countThisWeek,
} from "../lib/activity";
import { profileQueryOptions } from "../offline/queries";
import { useSyncStatus } from "../offline/sync";
import { DitherGradient } from "./dither-kit/gradient";
import { Rule } from "./ui/dither";
import { Page, PageHeader, Status } from "./ui/layout";

const WEEKS = 52;
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });
const keyFills = [0, 0.25, 0.5, 0.75, 1];

/** A day's square: a faint grey base, and green dither rising as high as the day was busy. */
function Cell({ fill }: { fill: number }) {
  return (
    <>
      <DitherGradient cell={1} direction="up" from="grey" opacity={0.22} />
      {fill ? (
        <span className="dx-activity-fill" style={{ height: `${fill * 100}%` }}>
          <DitherGradient cell={1} direction="up" from="green" />
        </span>
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
                    <Cell fill={activityFill(day.count, busiest)} />
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
      <Page>
        <PageHeader title="profile" />
        <Status loading title="opening your profile" />
      </Page>
    );
  }
  const { tracks, introductions, palace } = profile.data;
  const today = new Date();
  const weeks = activityCalendar(introductions, today, WEEKS);
  const streaks = activityStreaks(introductions, today);
  return (
    <Page>
      <PageHeader meta={<Link to="/settings">{who}</Link>} title="profile" />
      <div className="dx-scores">
        {tracks.map((track) => {
          const added = countThisWeek(track.introducedAt, today);
          return (
            <p key={track.id}>
              <b className="dx-score">{track.learned + track.learning}</b>
              <span>{track.label}</span>
              <small data-added={added > 0}>
                {added ? `+${added} this week` : "none this week"}
              </small>
            </p>
          );
        })}
      </div>
      <h2 className="dx-label dx-pro-group">
        <span>activity</span>
        <Rule />
        <span aria-hidden="true" className="dx-activity-key">
          less
          {keyFills.map((fill) => (
            <i key={fill}>
              <Cell fill={fill} />
            </i>
          ))}
          more
        </span>
      </h2>
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
    </Page>
  );
}
