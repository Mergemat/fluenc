// Home: the one thing to do next, large, beside a short list of everything else today. Reviews
// come first while any are due, then the next lesson, then reading. Each still opens on its own;
// the next one gets the page's only button, and Space or Enter.
import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useCallback, useMemo } from "react";
import { isShortcut, useWindowKeys } from "../hooks/use-window-keys";
import {
  activityCalendar,
  activityStreaks,
  dateOfKey,
  dayKey,
} from "../lib/activity";
import type { BuildItem, DashboardData } from "../lib/learner-views";
import { getItemMeaning } from "../lib/meaning";
import { nextReviews } from "../lib/review-schedule";
import { cn } from "../lib/utils";
import { useIntroductions } from "../progress/views";
import { DitherGradient } from "./dither-kit/gradient";
import { ActionButton } from "./ui/button";
import { MoviePinyin } from "./ui/hanzi";
import { Page, PageHeader, SectionHead } from "./ui/layout";

type Lead = "/review" | "/lessons" | "/reading";

// A review takes about twenty seconds a card.
const SECONDS_PER_CARD = 20;
const QUEUE_SHOWN = 12;
const WEEKDAYS = ["m", "t", "w", "t", "f", "s", "s"];
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function leadOf(data: DashboardData): Lead | null {
  if (data.reviewQueue.length) {
    return "/review";
  }
  if (data.buildQueue.length) {
    return "/lessons";
  }
  return data.getQueue.length ? "/reading" : null;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

// Next up: the page's one raised surface, on the gutter. Its padding is no more than the gutter
// around it.
const nextCard = "flex flex-col gap-4 rounded-xl bg-card p-6 max-md:p-4";
const nextHero = "flex min-w-0 items-end gap-6";
const nextGlyph = "flex-none font-hanzi text-7xl leading-none max-md:text-7xl";
const nextWhat = "m-0 grid min-w-0 gap-2 pb-2";
const nextPinyin = "type-control text-lg text-muted-foreground leading-none";

function NextHead({ meta }: { meta?: string }) {
  return <SectionHead className="mb-0" label="next up" meta={meta} />;
}

function Primary({ to, label }: { to: Lead; label: string }) {
  const navigate = useNavigate();
  const go = useCallback(() => navigate({ to }), [navigate, to]);
  return (
    <ActionButton
      className="mt-2 short:max-studio:h-11"
      color="blue"
      hint="space"
      onClick={go}
      variant="gradient"
    >
      {label}
    </ActionButton>
  );
}

function ReviewNext({ data }: { data: DashboardData }) {
  const due = data.reviewQueue.length;
  // A sentence card's hanzi is its answer, so only characters and words are shown.
  const [first, ...rest] = data.reviewQueue
    .filter((item) => item.type !== "sentence")
    .slice(0, QUEUE_SHOWN);
  return (
    <section aria-label="Next up" className={nextCard}>
      <NextHead meta="review · due now" />
      <div className={nextHero}>
        {first ? (
          <span className={nextGlyph} lang="zh-CN">
            {first.hanzi}
          </span>
        ) : null}
        <p className={nextWhat}>
          <b className="trim-cap type-display text-4xl tabular-nums leading-none tracking-snug">
            {due}
          </b>
          <span className="type-label grid gap-1 text-muted-foreground">
            <span>{due === 1 ? "card" : "cards"}</span>
            <span>
              about {Math.max(1, Math.round((due * SECONDS_PER_CARD) / 60))} min
            </span>
          </span>
        </p>
      </div>
      {rest.length ? (
        <ol
          aria-label="Cards after it"
          className="m-0 flex h-6 list-none flex-wrap gap-x-4 gap-y-6 overflow-hidden p-0 text-muted-foreground text-xl leading-6"
          lang="zh-CN"
        >
          {rest.map((item) => (
            <li
              className="flex-none font-hanzi"
              key={`${item.type}:${item.id}`}
            >
              {item.hanzi}
            </li>
          ))}
        </ol>
      ) : null}
      <Primary label="start review" to="/review" />
    </section>
  );
}

function LessonNext({ item }: { item: BuildItem }) {
  const meaning = getItemMeaning(item);
  return (
    <section aria-label="Next up" className={nextCard}>
      <NextHead
        meta={`learn · ${item.focus ?? (item.type === "word" ? "new word" : "new character")}`}
      />
      <div className={nextHero}>
        <span className={nextGlyph} lang="zh-CN">
          {item.hanzi}
        </span>
        <div className={nextWhat}>
          <b className="type-display text-2xl leading-none">
            {meaning.primary}
          </b>
          {item.type === "character" ? (
            <MoviePinyin
              actorKey={item.movie.actorKey}
              className={nextPinyin}
              finalKey={item.movie.finalKey}
              pinyin={item.pinyin}
              tone={item.movie.tone}
            />
          ) : (
            <span className={nextPinyin}>{item.pinyin}</span>
          )}
        </div>
      </div>
      <Primary label="open lesson" to="/lessons" />
    </section>
  );
}

function ReadingNext({
  sentence,
  count,
}: {
  sentence: DashboardData["getQueue"][number];
  count: number;
}) {
  return (
    <section aria-label="Next up" className={nextCard}>
      <NextHead meta={`read · ${plural(count, "sentence", "sentences")}`} />
      <p
        className="m-0 font-hanzi text-3xl leading-snug tracking-wide"
        lang="zh-CN"
      >
        {sentence.hanzi}
      </p>
      <Primary label="read" to="/reading" />
    </section>
  );
}

/** The next thing to do: what it is, as large as the page gets, and the one button. */
function NextUp({ data, lead }: { data: DashboardData; lead: Lead | null }) {
  const [item] = data.buildQueue;
  const [sentence] = data.getQueue;
  if (lead === "/review") {
    return <ReviewNext data={data} />;
  }
  if (lead === "/lessons" && item) {
    return <LessonNext item={item} />;
  }
  if (lead === "/reading" && sentence) {
    return <ReadingNext count={data.getQueue.length} sentence={sentence} />;
  }
  return (
    <section aria-label="Next up" className={nextCard}>
      <NextHead />
      <p className="type-body m-0 text-muted-foreground">
        nothing waiting — every lesson is learned
      </p>
    </section>
  );
}

/** One line in the list: a fixed slot on the left so every title starts on the same line. */
function Later({
  to,
  name,
  lead,
  label,
  children,
}: {
  to: "/review" | "/lessons" | "/reading" | "/profile";
  name: string;
  lead: string;
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    // Hairlines split the rows. A hovered row is raised over them, and its ring in the row's own
    // colour hides the one under it.
    <li className="not-first:inset-shadow-hairline">
      <Link
        aria-label={name}
        className="relative -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 ring-card transition hover:bg-card hover:ring-1"
        to={to}
      >
        <span
          aria-hidden="true"
          className="w-10 flex-none text-center font-hanzi text-3xl text-muted-foreground leading-none"
        >
          {lead}
        </span>
        <span className="grid min-w-0 flex-1 gap-2">
          <span className="type-label truncate text-muted-foreground">
            {label}
          </span>
          <span className="type-heading flex min-w-0 items-baseline gap-2 overflow-hidden whitespace-nowrap leading-none">
            {children}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** This week's days with something new, the way the profile's graph counts them. */
function useWeek() {
  const introductions = useIntroductions();
  const today = dayKey(new Date());
  return useMemo(() => {
    const now = dateOfKey(today);
    const [days = []] = activityCalendar(introductions, now, 1);
    return {
      today,
      days,
      active: days.filter((day) => day.count > 0).length,
      learning: activityStreaks(introductions, now).activeDays,
    };
  }, [introductions, today]);
}

/** Everything that isn't next, in the order it comes, and the week so far. */
function LaterToday({
  data,
  lead,
}: {
  data: DashboardData;
  lead: Lead | null;
}) {
  const week = useWeek();
  const [lesson] = data.buildQueue;
  const [sentence] = data.getQueue;
  const next = nextReviews(data, Date.now());
  return (
    <section aria-label="Later today">
      <SectionHead label="later today" />
      <ul className="m-0 list-none p-0">
        {lead === "/review" ? null : (
          <Later label="review" lead="复" name="Review" to="/review">
            <span className="type-body text-muted-foreground leading-none">
              all caught up{next ? ` · next ${next}` : ""}
            </span>
          </Later>
        )}
        {lead === "/lessons" || !lesson ? null : (
          <Later
            label={`learn next · ${lesson.focus ?? (lesson.type === "word" ? "new word" : "new character")}`}
            lead={lesson.hanzi}
            name="Learn"
            to="/lessons"
          >
            <span>{getItemMeaning(lesson).primary}</span>
            {lesson.type === "character" ? (
              <MoviePinyin
                actorKey={lesson.movie.actorKey}
                className="type-control"
                finalKey={lesson.movie.finalKey}
                pinyin={lesson.pinyin}
                tone={lesson.movie.tone}
              />
            ) : null}
          </Later>
        )}
        {lead === "/reading" || !sentence ? null : (
          <Later
            label={`read · ${plural(data.getQueue.length, "sentence", "sentences")}`}
            lead="句"
            name="Read"
            to="/reading"
          >
            <span
              className="truncate font-hanzi text-xl tracking-wide"
              lang="zh-CN"
            >
              {sentence.hanzi}
            </span>
          </Later>
        )}
        <Later
          label={`this week · ${plural(week.active, "day", "days")} · ${week.learning} learning`}
          lead="周"
          name="This week"
          to="/profile"
        >
          <span className="flex gap-1.5">
            {week.days.map((day, index) => (
              <span
                className="type-micro grid justify-items-center gap-1 text-muted-foreground"
                key={day.key}
              >
                <i
                  className={cn(
                    "relative size-6 overflow-hidden rounded-sm",
                    day.key === week.today
                      ? "inset-ring inset-ring-blue"
                      : "bg-popover"
                  )}
                  title={`${day.key} · ${day.count} new`}
                >
                  {day.count ? (
                    <DitherGradient
                      cell={2}
                      direction="up"
                      from="green"
                      opacity={0.85}
                    />
                  ) : null}
                </i>
                {WEEKDAYS[index]}
              </span>
            ))}
          </span>
        </Later>
      </ul>
    </section>
  );
}

export function TodayView({ data }: { data: DashboardData }) {
  const lead = leadOf(data);
  const navigate = useNavigate();
  useWindowKeys((event) => {
    if (
      lead &&
      !event.repeat &&
      (event.code === "Space" || event.key === "Enter") &&
      isShortcut(event)
    ) {
      event.preventDefault();
      navigate({ to: lead });
    }
  });

  return (
    <Page
      head={
        <PageHeader
          // The app shell renders with `ssr: false`, so this date never meets a server render.
          // react-doctor-disable-next-line react-doctor/no-locale-format-in-render, react-doctor/rendering-hydration-mismatch-time
          meta={dateFormat.format(new Date()).toLowerCase()}
          title="today"
        />
      }
    >
      <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-today">
        <NextUp data={data} lead={lead} />
        <LaterToday data={data} lead={lead} />
      </div>
    </Page>
  );
}
