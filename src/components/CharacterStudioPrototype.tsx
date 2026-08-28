// PROTOTYPE: three light ways to inspect the Hanzi Movie inputs. The movie stays in the learner's head.
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  DoorOpen,
  MapPinned,
  Package,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import { splitMeaning } from '../lib/meaning';
import { getToneDetail } from '../lib/tones';
import type { BuildItem } from '../server/curriculum';

type CharacterItem = Extract<BuildItem, { type: 'character' }>;
type Variant = 'a' | 'b' | 'c';
type MappingKey = 'actor' | 'set' | 'room' | `prop-${number}`;
type Mapping = {
  key: MappingKey;
  icon: ReactNode;
  glyph: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
};

const variants: Array<{ id: Variant; name: string }> = [
  { id: 'a', name: 'Halo' },
  { id: 'b', name: 'Rings' },
  { id: 'c', name: 'Field' },
];

export function CharacterStudioPrototype({ item }: { item: CharacterItem }) {
  const meaning = splitMeaning(item.meaning).primary;
  const tone = getToneDetail(item.movie.tone);
  const [variant, setVariant] = useState<Variant>('a');
  const [actorName, setActorName] = useState(item.movie.actorName);
  const [setName, setSetName] = useState(item.movie.setName);
  const [roomName, setRoomName] = useState(item.movie.roomName);
  const [props, setProps] = useState(item.movie.components);
  const [selected, setSelected] = useState<MappingKey>('actor');
  const [complete, setComplete] = useState(false);

  const mappings: Mapping[] = [
    {
      key: 'actor',
      icon: <UserRound size={16} />,
      glyph: item.movie.actorKey,
      label: 'Actor',
      value: actorName,
      setValue: setActorName,
    },
    {
      key: 'set',
      icon: <MapPinned size={16} />,
      glyph: item.movie.finalKey,
      label: 'Set',
      value: setName,
      setValue: setSetName,
    },
    {
      key: 'room',
      icon: <DoorOpen size={16} />,
      glyph: tone.mark,
      label: 'Room',
      value: roomName,
      setValue: setRoomName,
    },
    ...props.map((prop, index) => ({
      key: `prop-${index}` as const,
      icon: <Package size={16} />,
      glyph: prop.hanzi,
      label: 'Prop',
      value: prop.propName,
      setValue: (value: string) =>
        setProps((current) =>
          current.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, propName: value } : entry,
          ),
        ),
    })),
  ];
  const activeMapping =
    mappings.find((mapping) => mapping.key === selected) ?? mappings[0];
  const ready = mappings.every((mapping) => mapping.value.trim());

  useEffect(() => setVariant(readVariant()), []);

  const chooseVariant = (next: Variant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState({}, '', url);
    setVariant(next);
  };
  const cycle = (direction: -1 | 1) => {
    const index = variants.findIndex((entry) => entry.id === variant);
    chooseVariant(
      variants[(index + direction + variants.length) % variants.length].id,
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable]')) return;
      if (event.key === 'ArrowLeft') cycle(-1);
      if (event.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const propsForStudio: StudioProps = {
    activeMapping,
    complete,
    item,
    mappings,
    meaning,
    ready,
    selected,
    setComplete,
    setSelected,
  };

  return (
    <>
      {variant === 'a' ? <HaloVariant {...propsForStudio} /> : null}
      {variant === 'b' ? <RingsVariant {...propsForStudio} /> : null}
      {variant === 'c' ? <FieldVariant {...propsForStudio} /> : null}

      {import.meta.env.DEV ? (
        <nav
          className="fixed bottom-[76px] left-1/2 z-20 flex h-11 -translate-x-1/2 items-center rounded-full border border-ink/15 bg-ink px-1 text-paper shadow-[0_8px_28px_rgba(0,0,0,.2)] md:bottom-5"
          aria-label="Prototype variant"
        >
          <button
            className="grid size-9 place-items-center rounded-full hover:bg-paper/15"
            type="button"
            aria-label="Previous variant"
            onClick={() => cycle(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-28 px-2 text-center text-[11px] font-black uppercase tracking-[.08em]">
            {variant.toUpperCase()} ·{' '}
            {variants.find((entry) => entry.id === variant)?.name}
          </span>
          <button
            className="grid size-9 place-items-center rounded-full hover:bg-paper/15"
            type="button"
            aria-label="Next variant"
            onClick={() => cycle(1)}
          >
            <ChevronRight size={18} />
          </button>
        </nav>
      ) : null}

      <p className="sr-only" aria-live="polite">
        Character {item.hanzi}.{' '}
        {mappings
          .map((mapping) => `${mapping.label} ${mapping.value || 'unset'}`)
          .join('. ')}
        .
      </p>
    </>
  );
}

type StudioProps = {
  activeMapping: Mapping;
  complete: boolean;
  item: CharacterItem;
  mappings: Mapping[];
  meaning: string;
  ready: boolean;
  selected: MappingKey;
  setComplete: (complete: boolean) => void;
  setSelected: (key: MappingKey) => void;
};

function HaloVariant(props: StudioProps) {
  const positions: CSSProperties[] = [
    { left: '50%', top: '8%', transform: 'translate(-50%, -50%)' },
    { left: '15%', top: '48%', transform: 'translate(-50%, -50%)' },
    { left: '85%', top: '48%', transform: 'translate(-50%, -50%)' },
    { left: '35%', top: '89%', transform: 'translate(-50%, -50%)' },
    { left: '65%', top: '89%', transform: 'translate(-50%, -50%)' },
  ];

  return (
    <StudioShell item={props.item}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute rounded-[50%] border border-line"
          style={{ inset: '12% 10%' }}
        />
        <CharacterCore item={props.item} meaning={props.meaning} />
        {props.mappings.slice(0, 5).map((mapping, index) => (
          <CueNode
            key={mapping.key}
            mapping={mapping}
            selected={props.selected === mapping.key}
            style={positions[index]}
            onSelect={props.setSelected}
          />
        ))}
      </div>
      <StudioFooter {...props} />
    </StudioShell>
  );
}

function RingsVariant(props: StudioProps) {
  const sound = props.mappings.slice(0, 3);
  const form = props.mappings.slice(3, 6);
  const innerPositions: CSSProperties[] = [
    { left: '50%', top: '21%', transform: 'translate(-50%, -50%)' },
    { left: '29%', top: '69%', transform: 'translate(-50%, -50%)' },
    { left: '71%', top: '69%', transform: 'translate(-50%, -50%)' },
  ];
  const outerPositions: CSSProperties[] = [
    { left: '15%', top: '25%', transform: 'translate(-50%, -50%)' },
    { left: '85%', top: '25%', transform: 'translate(-50%, -50%)' },
    { left: '50%', top: '91%', transform: 'translate(-50%, -50%)' },
  ];

  return (
    <StudioShell item={props.item}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute rounded-full border border-line"
          style={{ inset: '7% 8%' }}
        />
        <div
          className="absolute rounded-full border border-line"
          style={{ inset: '25% 24%' }}
        />
        <CharacterCore item={props.item} meaning={props.meaning} compact />
        {sound.map((mapping, index) => (
          <CueNode
            key={mapping.key}
            mapping={mapping}
            selected={props.selected === mapping.key}
            style={innerPositions[index]}
            onSelect={props.setSelected}
            compact
          />
        ))}
        {form.map((mapping, index) => (
          <CueNode
            key={mapping.key}
            mapping={mapping}
            selected={props.selected === mapping.key}
            style={outerPositions[index]}
            onSelect={props.setSelected}
          />
        ))}
      </div>
      <StudioFooter {...props} />
    </StudioShell>
  );
}

function FieldVariant(props: StudioProps) {
  const nodePositions = [
    { x: 24, y: 20 },
    { x: 77, y: 23 },
    { x: 15, y: 62 },
    { x: 78, y: 68 },
    { x: 34, y: 88 },
  ];
  const center = { x: 49, y: 49 };

  return (
    <StudioShell item={props.item}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <svg
          className="absolute inset-0 size-full"
          aria-hidden="true"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {props.mappings.slice(0, 5).map((mapping, index) => (
            <line
              key={mapping.key}
              x1={center.x}
              y1={center.y}
              x2={nodePositions[index].x}
              y2={nodePositions[index].y}
              stroke={
                props.selected === mapping.key ? 'currentColor' : '#d9d3c7'
              }
              strokeWidth={props.selected === mapping.key ? 0.55 : 0.3}
              className={
                props.selected === mapping.key ? 'text-glaze' : undefined
              }
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <CharacterCore item={props.item} meaning={props.meaning} />
        {props.mappings.slice(0, 5).map((mapping, index) => (
          <CueNode
            key={mapping.key}
            mapping={mapping}
            selected={props.selected === mapping.key}
            style={{
              left: `${nodePositions[index].x}%`,
              top: `${nodePositions[index].y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onSelect={props.setSelected}
          />
        ))}
      </div>
      <StudioFooter {...props} />
    </StudioShell>
  );
}

function StudioShell({
  children,
  item,
}: {
  children: ReactNode;
  item: CharacterItem;
}) {
  return (
    <article className="flex h-[calc(100dvh-143px)] min-h-[470px] flex-col overflow-hidden rounded-[24px] border border-line bg-paper text-ink md:h-[calc(100dvh-48px)] md:min-h-[560px]">
      <header className="flex h-12 shrink-0 items-center border-b border-line px-4">
        <Clapperboard size={16} className="text-glaze" />
        <span className="ml-2 text-[10px] font-black uppercase tracking-[.12em] text-muted">
          Character {item.rank}
        </span>
      </header>
      {children}
    </article>
  );
}

function CharacterCore({
  compact = false,
  item,
  meaning,
}: {
  compact?: boolean;
  item: CharacterItem;
  meaning: string;
}) {
  return (
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 bg-paper px-3 py-2 text-center">
      <span
        className={`block font-hanzi font-normal leading-none text-ink ${compact ? 'text-6xl' : 'text-7xl'}`}
        lang="zh-CN"
      >
        {item.hanzi}
      </span>
      <span className="mt-1 block text-sm font-black">{item.pinyin}</span>
      <span className="block text-[10px] font-bold text-muted">{meaning}</span>
    </div>
  );
}

function CueNode({
  compact = false,
  mapping,
  onSelect,
  selected,
  style,
}: {
  compact?: boolean;
  mapping: Mapping;
  onSelect: (key: MappingKey) => void;
  selected: boolean;
  style: CSSProperties;
}) {
  return (
    <button
      className={`absolute z-10 grid max-w-28 justify-items-center gap-1 rounded-full border bg-paper text-center transition ${compact ? 'min-w-14 px-2 py-1.5' : 'min-w-16 px-2 py-2'} ${selected ? 'border-glaze text-glaze shadow-[0_3px_14px_rgba(242,73,45,.12)]' : 'border-line text-ink'}`}
      style={style}
      type="button"
      onClick={() => onSelect(mapping.key)}
      aria-pressed={selected}
    >
      <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-muted">
        <span className={selected ? 'text-glaze' : ''}>{mapping.icon}</span>
        {mapping.label}
      </span>
      <strong className="max-w-24 truncate text-[10px]">
        {mapping.value || 'Unset'}
      </strong>
    </button>
  );
}

function StudioFooter({
  activeMapping,
  complete,
  ready,
  setComplete,
}: StudioProps) {
  return (
    <div className="shrink-0 border-t border-line bg-canvas/65 p-3 pb-14 md:pb-4">
      <label className="grid h-12 grid-cols-[44px_1fr] overflow-hidden rounded-xl border border-line bg-paper text-ink">
        <span className="grid place-items-center border-r border-line font-hanzi text-lg font-black text-glaze">
          {activeMapping.glyph}
        </span>
        <span className="relative">
          <small className="absolute left-3 top-1 text-[8px] font-black uppercase tracking-widest text-faint">
            {activeMapping.label}
          </small>
          <input
            className="h-full w-full bg-transparent px-3 pb-1 pt-4 text-sm font-black outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-glaze"
            value={activeMapping.value}
            placeholder={`Name ${activeMapping.label.toLowerCase()}`}
            onChange={(event) => activeMapping.setValue(event.target.value)}
          />
        </span>
      </label>
      <FinishButton
        complete={complete}
        ready={ready}
        setComplete={setComplete}
      />
    </div>
  );
}

function FinishButton({
  complete,
  ready,
  setComplete,
}: {
  complete: boolean;
  ready: boolean;
  setComplete: (complete: boolean) => void;
}) {
  if (complete)
    return (
      <button
        className="mt-2 grid h-11 w-full place-items-center rounded-xl bg-glaze text-paper"
        type="button"
        aria-label="Reset prototype completion"
        onClick={() => setComplete(false)}
      >
        <span className="inline-flex items-center gap-2 text-xs font-black">
          <Check size={16} /> Added <RotateCcw size={13} />
        </span>
      </button>
    );
  return (
    <button
      className="mt-2 h-11 w-full rounded-xl bg-ink text-xs font-black text-paper disabled:bg-faint"
      type="button"
      disabled={!ready}
      onClick={() => setComplete(true)}
    >
      Add to review
    </button>
  );
}

function readVariant(): Variant {
  if (typeof window === 'undefined') return 'a';
  const value = new URLSearchParams(window.location.search).get('variant');
  return value === 'b' || value === 'c' ? value : 'a';
}
