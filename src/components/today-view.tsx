// Home: the one thing to do next, large, beside a short list of everything else today. Reviews
// come first while any are due, then the next lesson, then reading. Each still opens on its own;
// the next one gets the page's only button, and Space or Enter.
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
} from "react";

import {
  activityCalendar,
  activityStreaks,
  dateOfKey,
  dayKey,
} from "../lib/activity";
import type { DashboardData } from "../lib/learner-views";
import { getItemMeaning } from "../lib/meaning";
import { profileQueryOptions } from "../offline/queries";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { nextReviews } from "./review-view";
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

function Primary({ to, label }: { to: Lead; label: string }) {
  const navigate = useNavigate();
  const go = useCallback(() => navigate({ to }), [navigate, to]);
  return (
    <DitherButton
      className="dx-action"
      color="blue"
      onClick={go}
      variant="gradient"
    >
      <span>{label}</span>
      <kbd>space</kbd>
    </DitherButton>
  );
}

/** The next thing to do: what it is, as large as the page gets, and the one button. */
function NextUp({ data, lead }: { data: DashboardData; lead: Lead | null }) {
  if (lead === "/review") {
    const due = data.reviewQueue.length;
    // A sentence card's hanzi is its answer, so only characters and words are shown.
    const [first, ...rest] = data.reviewQueue
      .filter((item) => item.type !== "sentence")
      .slice(0, QUEUE_SHOWN);
    return (
      <section aria-label="Next up" className="dx-next">
        <SectionHead label="next up" meta="review · due now" />
        <div className="dx-next-hero">
          {first ? (
            <span className="dx-next-glyph font-hanzi" lang="zh-CN">
              {first.hanzi}
            </span>
          ) : null}
          <p className="dx-next-what">
            <b className="dx-next-num">{due}</b>
            <span>
              {due === 1 ? "card" : "cards"} · about{" "}
              {Math.max(1, Math.round((due * SECONDS_PER_CARD) / 60))} min
            </span>
          </p>
        </div>
        {rest.length ? (
          <ol
            aria-label="Cards after it"
            className="dx-next-queue"
            lang="zh-CN"
          >
            {rest.map((item) => (
              <li className="font-hanzi" key={`${item.type}:${item.id}`}>
                {item.hanzi}
              </li>
            ))}
          </ol>
        ) : null}
        <Primary label="start review" to="/review" />
      </section>
    );
  }
  if (lead === "/lessons") {
    const [item] = data.buildQueue;
    if (item) {
      const meaning = getItemMeaning(item);
      return (
        <section aria-label="Next up" className="dx-next">
          <SectionHead
            label="next up"
            meta={`learn · ${item.focus ?? (item.type === "word" ? "new word" : "new character")}`}
          />
          <div className="dx-next-hero">
            <span className="dx-next-glyph font-hanzi" lang="zh-CN">
              {item.hanzi}
            </span>
            <div className="dx-next-what">
              <b className="dx-next-title">{meaning.primary}</b>
              {item.type === "character" ? (
                <MoviePinyin
                  actorKey={item.movie.actorKey}
                  finalKey={item.movie.finalKey}
                  pinyin={item.pinyin}
                  tone={item.movie.tone}
                />
              ) : (
                <span className="dx-next-pinyin">{item.pinyin}</span>
              )}
            </div>
          </div>
          <Primary label="open lesson" to="/lessons" />
        </section>
      );
    }
  }
  if (lead === "/reading") {
    const [sentence] = data.getQueue;
    if (sentence) {
      return (
        <section aria-label="Next up" className="dx-next">
          <SectionHead
            label="next up"
            meta={`read · ${plural(data.getQueue.length, "sentence", "sentences")}`}
          />
          <p className="dx-next-sentence font-hanzi" lang="zh-CN">
            {sentence.hanzi}
          </p>
          <Primary label="read" to="/reading" />
        </section>
      );
    }
  }
  return (
    <section aria-label="Next up" className="dx-next">
      <SectionHead label="next up" />
      <p className="dx-next-done">nothing waiting — every lesson is learned</p>
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
    <li>
      <Link aria-label={name} className="dx-later-row" to={to}>
        <span aria-hidden="true" className="dx-later-lead font-hanzi">
          {lead}
        </span>
        <span className="dx-later-body">
          <span className="dx-later-label">{label}</span>
          <span className="dx-later-title">{children}</span>
        </span>
      </Link>
    </li>
  );
}

/** This week's days with something new, the way the profile's graph counts them. */
function useWeek() {
  const { data } = useQuery(profileQueryOptions);
  const today = dayKey(new Date());
  return useMemo(() => {
    if (!data) {
      return null;
    }
    const now = dateOfKey(today);
    const [days = []] = activityCalendar(data.introductions, now, 1);
    return {
      today,
      days,
      active: days.filter((day) => day.count > 0).length,
      learning: activityStreaks(data.introductions, now).activeDays,
    };
  }, [data, today]);
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
    <section aria-label="Later today" className="dx-later">
      <SectionHead label="later today" />
      <ul className="dx-later-list">
        {lead === "/review" ? null : (
          <Later label="review" lead="复" name="Review" to="/review">
            <span className="dx-later-quiet">
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
            <span className="dx-later-sentence font-hanzi" lang="zh-CN">
              {sentence.hanzi}
            </span>
          </Later>
        )}
        <Later
          label={
            week
              ? `this week · ${plural(week.active, "day", "days")} · ${week.learning} learning`
              : "this week"
          }
          lead="周"
          name="This week"
          to="/profile"
        >
          <span className="dx-later-days">
            {(week?.days ?? []).map((day, index) => (
              <span
                className="dx-later-day"
                data-today={day.key === week?.today}
                key={day.key}
              >
                <i title={`${day.key} · ${day.count} new`}>
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
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      !lead ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !(event.code === "Space" || event.key === "Enter")
    ) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, button, a, [role=dialog]")
    ) {
      return;
    }
    event.preventDefault();
    navigate({ to: lead });
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Page>
      <PageHeader
        meta={dateFormat.format(new Date()).toLowerCase()}
        title="today"
      />
      <div className="dx-today">
        <NextUp data={data} lead={lead} />
        <LaterToday data={data} lead={lead} />
      </div>
    </Page>
  );
}
