// The learner's own page: the course divided into the method's stages, the milestones along each,
// and the memory palace they have built. Derived from the cached progress, so it works offline.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import type { ClueKind } from "../lib/palace-board";
import type { Milestone, ProfileData, ProgressTrack } from "../lib/profile";
import { profileQueryOptions } from "../offline/queries";
import { useSyncStatus } from "../offline/sync";
import { DitherGradient } from "./dither-kit/gradient";
import { Rule } from "./ui/dither";
import { Page, PageHeader, Status } from "./ui/layout";
import { SplitMeter } from "./ui/split-meter";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const day = (iso: string) => dayFormat.format(new Date(iso)).toLowerCase();

/** What the stage is for, in the method's words. */
const trackNotes: Record<ProgressTrack["id"], string> = {
  code: "actors and sets you cast",
  props: "images for character parts",
  characters: "hanzi movies",
  words: "built from known characters",
  sentences: "read and shadowed",
};

const palaceTiles: { kind: ClueKind; label: string }[] = [
  { kind: "cast", label: "cast" },
  { kind: "sets", label: "sets" },
  { kind: "areas", label: "tone areas" },
  { kind: "props", label: "props" },
];

const isPalace = (track: ProgressTrack) =>
  track.id === "code" || track.id === "props";

function trackText(track: ProgressTrack) {
  const left = track.total - track.learned - track.learning;
  return isPalace(track)
    ? `${track.learned} named, ${left} open`
    : `${track.learned} learned, ${track.learning} learning, ${left} to go`;
}

/** The unreached milestone closest to done: study material first, then the palace. */
function nextMilestone(tracks: ProgressTrack[]) {
  const closest = (candidates: ProgressTrack[]) => {
    let best: Milestone | null = null;
    for (const milestone of candidates.flatMap((track) => track.milestones)) {
      if (
        !milestone.reached &&
        (!best ||
          milestone.progress / milestone.target > best.progress / best.target)
      ) {
        best = milestone;
      }
    }
    return best;
  };
  return (
    closest(tracks.filter((track) => !isPalace(track))) ??
    closest(tracks.filter(isPalace))
  );
}

function lastMilestone(tracks: ProgressTrack[]) {
  return tracks
    .flatMap((track) => track.milestones)
    .filter((milestone) => milestone.reachedAt)
    .toSorted((left, right) =>
      (right.reachedAt ?? "").localeCompare(left.reachedAt ?? "")
    )[0];
}

const milestoneName = (milestone: Milestone) =>
  milestone.all
    ? `all ${milestone.target} ${milestone.unit}`
    : `${milestone.target} ${milestone.unit}`;

function Hero({ data }: { data: ProfileData }) {
  const next = nextMilestone(data.tracks);
  const last = lastMilestone(data.tracks);
  return (
    <section aria-label="Next milestone" className="dx-pro-hero">
      <DitherGradient cell={3} direction="up" from="blue" opacity={0.28} />
      {next ? (
        <div className="dx-pro-next">
          <p className="dx-label">next milestone</p>
          <p className="dx-pro-togo">
            <b className="dx-pro-count">{next.target - next.progress}</b>
            <span>to {milestoneName(next)}</span>
          </p>
          <SplitMeter
            label={`Toward ${milestoneName(next)}`}
            learned={next.progress}
            text={`${next.progress} of ${next.target}`}
            total={next.target}
          />
        </div>
      ) : (
        <div className="dx-pro-next">
          <p className="dx-label">every milestone reached</p>
          <p className="dx-pro-togo">
            <b className="dx-pro-count">全</b>
            <span>the whole course is yours</span>
          </p>
        </div>
      )}
      <dl className="dx-pro-facts">
        <div>
          <dt>learning since</dt>
          <dd>{data.since ? day(data.since) : "your first lesson"}</dd>
        </div>
        <div>
          <dt>last milestone</dt>
          <dd>
            {last?.reachedAt
              ? `${milestoneName(last)} · ${day(last.reachedAt)}`
              : "not yet"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function MilestoneBadge({
  milestone,
  next,
}: {
  milestone: Milestone;
  next: boolean;
}) {
  let state = "ahead";
  if (milestone.reached) {
    state = "reached";
  } else if (next) {
    state = "next";
  }
  let detail = `${milestone.target - milestone.progress} to go`;
  if (milestone.reached) {
    detail = milestone.reachedAt ? day(milestone.reachedAt) : "reached";
  }
  return (
    <li className="dx-mile" data-state={state}>
      {milestone.reached ? (
        <DitherGradient cell={2} direction="up" from="green" opacity={0.4} />
      ) : null}
      <b className="dx-mile-target">{milestone.target}</b>
      <span>{milestone.all ? `all ${milestone.unit}` : milestone.unit}</span>
      <small>{detail}</small>
    </li>
  );
}

function Track({ track, index }: { track: ProgressTrack; index: number }) {
  const left = track.total - track.learned - track.learning;
  const firstOpen = track.milestones.findIndex((item) => !item.reached);
  return (
    <section aria-labelledby={`track-${track.id}`} className="dx-track">
      <header className="dx-track-head">
        <span className="dx-track-step">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="dx-track-title" id={`track-${track.id}`}>
          {track.label}
        </h3>
        <span className="dx-track-note">{trackNotes[track.id]}</span>
        <span className="dx-track-count">
          {track.learned + track.learning}
          <small>/{track.total}</small>
        </span>
      </header>
      <SplitMeter
        label={`${track.label} progress`}
        learned={track.learned}
        learning={track.learning}
        marks={track.milestones.map((item) => item.target)}
        text={trackText(track)}
        total={track.total}
      />
      <p className="dx-track-legend">
        <span data-tone="learned">
          <i aria-hidden="true" />
          {track.learned} {isPalace(track) ? "named" : "learned"}
        </span>
        {isPalace(track) ? null : (
          <span data-tone="learning">
            <i aria-hidden="true" />
            {track.learning} learning
          </span>
        )}
        <span data-tone="left">
          <i aria-hidden="true" />
          {left} {isPalace(track) ? "open" : "to go"}
        </span>
      </p>
      <ol aria-label={`${track.label} milestones`} className="dx-miles">
        {track.milestones.map((milestone, position) => (
          <MilestoneBadge
            key={milestone.key}
            milestone={milestone}
            next={position === firstOpen}
          />
        ))}
      </ol>
    </section>
  );
}

function Palace({ data }: { data: ProfileData }) {
  return (
    <div className="dx-pro-palace">
      {palaceTiles.map((tile) => {
        const { named, total } = data.palace[tile.kind];
        return (
          <Link
            className="dx-pro-room"
            key={tile.kind}
            search={{ tab: tile.kind }}
            to="/profile/palace"
          >
            <span className="dx-pro-room-name">{tile.label}</span>
            <span className="dx-pro-room-count">
              {named}
              <small>/{total}</small>
            </span>
            <ChevronRight aria-hidden="true" size={15} />
            <span
              className="dx-pal-bar"
              style={{ width: `${total ? (named / total) * 100 : 0}%` }}
            >
              <DitherGradient cell={2} direction="left" from="green" />
            </span>
          </Link>
        );
      })}
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
  return (
    <Page>
      <PageHeader meta={<Link to="/settings">{who}</Link>} title="profile" />
      <Hero data={profile.data} />
      <h2 className="dx-label dx-pro-group">
        <span>progress</span>
        <Rule />
      </h2>
      <div className="dx-tracks">
        {profile.data.tracks.map((track, index) => (
          <Track index={index} key={track.id} track={track} />
        ))}
      </div>
      <h2 className="dx-label dx-pro-group">
        <span>memory palace</span>
        <Rule />
        <Link to="/profile/palace">open</Link>
      </h2>
      <Palace data={profile.data} />
    </Page>
  );
}
