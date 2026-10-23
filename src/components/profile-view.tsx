// The learner's own page: every course character as one pixel on a wall, cut into blocks at the
// milestones, then words, sentences and the memory palace as a line each. Derived from the cached
// progress, so it works offline.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import type { Milestone, ProfileData } from "../lib/profile";
import { profileQueryOptions } from "../offline/queries";
import { useSyncStatus } from "../offline/sync";
import { DitherGradient } from "./dither-kit/gradient";
import type { PixelColor } from "./dither-kit/pixel";
import { Page, PageHeader, Status } from "./ui/layout";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const cellColor: Record<ProfileData["wall"][number]["status"], PixelColor> = {
  review: "green",
  learning: "orange",
  new: "grey",
};

function Block({
  milestone,
  cells,
}: {
  milestone: Milestone;
  cells: ProfileData["wall"];
}) {
  return (
    <div className="dx-block" data-reached={milestone.reached}>
      <span
        className="dx-block-label"
        title={
          milestone.reachedAt
            ? `reached ${dayFormat.format(new Date(milestone.reachedAt))}`
            : undefined
        }
      >
        {milestone.target}
      </span>
      <span className="dx-cells">
        {cells.map((cell) => (
          <i
            data-status={cell.status}
            key={cell.id}
            title={`${cell.hanzi} ${cell.keyword}`}
          >
            <DitherGradient
              cell={1}
              direction="up"
              from={cellColor[cell.status]}
              opacity={cell.status === "new" ? 0.45 : 1}
            />
          </i>
        ))}
      </span>
    </div>
  );
}

function Wall({ data }: { data: ProfileData }) {
  const track = data.tracks.find((item) => item.id === "characters");
  if (!track) {
    return null;
  }
  return (
    <section aria-labelledby="wall-title" className="dx-wall-chars">
      <header className="dx-pro-row">
        <h2 id="wall-title">characters</h2>
        <span>
          <b className="dx-pro-num">{track.learned + track.learning}</b>/
          {track.total}
        </span>
      </header>
      <p className="dx-pro-key">
        <span data-tone="review">{track.learned} learned</span>
        <span data-tone="learning">{track.learning} learning</span>
        <span data-tone="new">
          {track.total - track.learned - track.learning} new
        </span>
      </p>
      <div aria-hidden="true" className="dx-blocks">
        {track.milestones.map((milestone, index) => (
          <Block
            cells={data.wall.slice(
              track.milestones[index - 1]?.target ?? 0,
              milestone.target
            )}
            key={milestone.key}
            milestone={milestone}
          />
        ))}
      </div>
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
      <Wall data={profile.data} />
      {tracks
        .filter((track) => track.id !== "characters")
        .map((track) => (
          <p className="dx-pro-row" key={track.id}>
            <span className="dx-pro-name">{track.label}</span>
            <span>
              <b className="dx-pro-num">{track.learned + track.learning}</b>/
              {track.total}
            </span>
          </p>
        ))}
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
