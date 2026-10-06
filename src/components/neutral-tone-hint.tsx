import { getNeutralToneExample } from "../lib/pinyin-audio";

interface Props {
  className?: string;
  pinyin: string;
  text: string;
}

export function NeutralToneBadge({ text, pinyin, className = "" }: Props) {
  const example = getNeutralToneExample(text, pinyin);
  if (!example) {
    return null;
  }

  return (
    <span
      className={`w-max text-[10px] text-faint uppercase tracking-wide ${className}`.trim()}
      title={`Neutral tone, as in ${example.text} · ${example.pinyin}`}
    >
      neutral
    </span>
  );
}

export function NeutralToneExample({ text, pinyin, className = "" }: Props) {
  const example = getNeutralToneExample(text, pinyin);
  if (!example) {
    return null;
  }

  return (
    <span className={`text-muted text-xs ${className}`.trim()}>
      As in{" "}
      <span className="font-hanzi" lang="zh-CN">
        {example.text}
      </span>{" "}
      · {example.pinyin}
    </span>
  );
}
