// The learner's own page: characters, words and sentences, each a bar divided at its milestones,
// and a way into the memory palace. Derived from the cached progress, so it works offline.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import type { Milestone, ProgressTrack } from "../lib/profile";
import { profileQueryOptions } from "../offline/queries";
import { useSyncStatus } from "../offline/sync";
import { DitherGradient } from "./dither-kit/gradient";
import { Page, PageHeader, Status } from "./ui/layout";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const share = (part: number, size: number) =>
  `${Math.min(Math.max(part / size, 0), 1) * 100}%`;

/** The stretch of a track between the previous milestone and this one. */
function Segment({
  from,
  milestone,
  track,
}: {
  from: number;
  milestone: Milestone;
  track: ProgressTrack;
}) {
  const size = milestone.target - from;
  const learned = track.learned - from;
  const started = track.learned + track.learning - from;
  return (
    <li className="dx-step" data-reached={milestone.reached}>
      <span className="dx-progress">
        <DitherGradient cell={2} direction="right" from="grey" opacity={0.5} />
        <span
          className="dx-progress-fill"
          style={{ width: share(started, size) }}
        >
          <DitherGradient cell={2} direction="left" from="orange" />
        </span>
        <span
          className="dx-progress-fill"
          style={{ width: share(learned, size) }}
        >
          <DitherGradient cell={2} direction="left" from="green" />
        </span>
      </span>
      <span
        className="dx-step-label"
        title={
          milestone.reachedAt
            ? `reached ${dayFormat.format(new Date(milestone.reachedAt))}`
            : undefined
        }
      >
        {milestone.target}
      </span>
    </li>
  );
}

function Track({ track }: { track: ProgressTrack }) {
  const started = track.learned + track.learning;
  const next = track.milestones.find((milestone) => !milestone.reached);
  return (
    <section aria-labelledby={`track-${track.id}`} className="dx-pro-track">
      <header>
        <h2 id={`track-${track.id}`}>{track.label}</h2>
        <span>
          <b className="dx-pro-num">{started}</b>/{track.total}
        </span>
      </header>
      <ol
        aria-label={`${track.label}: ${track.learned} learned, ${track.learning} learning${
          next ? `, ${next.target - next.progress} to the next milestone` : ""
        }`}
        className="dx-steps"
      >
        {track.milestones.map((milestone, index) => (
          <Segment
            from={track.milestones[index - 1]?.target ?? 0}
            key={milestone.key}
            milestone={milestone}
            track={track}
          />
        ))}
      </ol>
    </section>
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
  const { tracks, palace } = profile.data;
  return (
    <Page>
      <PageHeader meta={<Link to="/settings">{who}</Link>} title="profile" />
      <p aria-hidden="true" className="dx-pro-key">
        <span data-tone="learned">learned</span>
        <span data-tone="learning">learning</span>
      </p>
      {tracks.map((track) => (
        <Track key={track.id} track={track} />
      ))}
      <Link className="dx-pro-palace" to="/profile/palace">
        <span>memory palace</span>
        <span>
          <b className="dx-pro-num">{palace.named}</b>/{palace.total} named
        </span>
        <ChevronRight aria-hidden="true" size={15} />
      </Link>
    </Page>
  );
}
