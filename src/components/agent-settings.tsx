import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Unplug } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";

import { cn } from "../lib/utils";
import { useSyncStatus } from "../progress/sync";
import claudeLogo from "./agent-logos/claude.svg";
import codexLogo from "./agent-logos/codex.svg";
import cursorLogo from "./agent-logos/cursor.svg";
import vscodeLogo from "./agent-logos/vscode.svg";
import { ToolButton } from "./ui/button";
import { Chip } from "./ui/chip";
import { chip } from "./ui/layout";
import { SettingRow, type Tone } from "./ui/setting-row";

interface Agent {
  clientId: string;
  connectedAt: string;
  name: string;
}
const agentsKey = ["agents"];

interface AgentsState {
  agents: Agent[] | null;
  mcpUrl: string;
}

async function request(body?: { disconnect: string }) {
  const response = await fetch("/api/agents", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`agents ${response.status}`);
  }
  return (await response.json()) as AgentsState;
}

type AgentId = "claude" | "codex" | "cursor" | "vscode";

/** What the learner asks once connected, shown by example. */
const FIRST_ASK =
  "put these words from my class first in fluenc: 学生 老师 忧郁";

/** Step one adds fluenc to the agent: a command to paste, or a link the editor opens. */
type Step =
  | { kind: "copy"; text: string }
  | { kind: "open"; label: string; href: string }
  | { kind: "note"; text: string };

const AGENTS: Record<
  AgentId,
  {
    name: string;
    logo: string;
    /** The agent's name as it registers, to match connected agents to a logo. */
    matches: RegExp;
    add: (url: string) => Step;
    signIn: string;
  }
> = {
  claude: {
    name: "claude code",
    logo: claudeLogo,
    matches: /claude/iu,
    add: (url) => ({
      kind: "copy",
      text: `claude mcp add --transport http fluenc ${url}`,
    }),
    signIn: "in claude code, run /mcp, pick fluenc, then allow",
  },
  codex: {
    name: "codex",
    logo: codexLogo,
    matches: /codex/iu,
    add: (url) => ({ kind: "copy", text: `codex mcp add fluenc --url ${url}` }),
    signIn: "a fluenc tab opens by itself: allow",
  },
  cursor: {
    name: "cursor",
    logo: cursorLogo,
    matches: /cursor/iu,
    add: (url) => ({
      kind: "open",
      label: "add to cursor",
      href: `cursor://anysphere.cursor-deeplink/mcp/install?name=fluenc&config=${btoa(JSON.stringify({ url }))}`,
    }),
    signIn: "in cursor’s mcp settings, sign in next to fluenc, then allow",
  },
  vscode: {
    name: "vs code",
    logo: vscodeLogo,
    matches: /visual studio code|vs ?code|copilot/iu,
    add: (url) => ({
      kind: "open",
      label: "add to vs code",
      href: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: "fluenc", type: "http", url }))}`,
    }),
    signIn: "vs code asks to sign in to fluenc: allow",
  },
};
const AGENT_IDS = Object.keys(AGENTS) as AgentId[];

const logoOf = (name: string) =>
  AGENT_IDS.map((id) => AGENTS[id]).find((agent) => agent.matches.test(name))
    ?.logo;

function Logo({ src }: { src: string }) {
  return (
    <img
      alt=""
      className="size-3.5 shrink-0"
      height={14}
      src={src}
      width={14}
    />
  );
}

const connectedOn = (time: string) =>
  new Date(time).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

function agentsStatus(
  failed: boolean,
  signedIn: boolean,
  count: number
): [Tone, string] {
  if (failed) {
    return ["error", "couldn’t check"];
  }
  if (!signedIn) {
    return ["idle", "sign in first"];
  }
  return count ? ["ok", `${count} connected`] : ["idle", "not connected"];
}

function CopyButton({ text, done }: { text: string; done: string }) {
  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast(done))
      .catch(() => toast("couldn’t copy"));
  }, [text, done]);
  return (
    <button aria-label="copy" className={chip} onClick={copy} type="button">
      <Copy size={13} />
    </button>
  );
}

/** One numbered step: what to do, and the thing to copy or open when there is one. */
function StepLine({ index, children }: { index: number; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.25rem_1fr] items-start gap-x-2">
      <span className="type-label text-faint-foreground pt-1.5 tabular-nums">
        {index}
      </span>
      <div className="flex min-w-0 items-start gap-2">{children}</div>
    </li>
  );
}

const quote =
  "text-foreground min-w-0 flex-1 rounded-md bg-card px-2.5 py-1.5 wrap-break-word";

function Steps({ id, url }: { id: AgentId; url: string }) {
  const agent = AGENTS[id];
  const add = agent.add(url);
  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      <StepLine index={1}>
        {add.kind === "copy" ? (
          <>
            <code className={cn(quote, "type-control")}>{add.text}</code>
            <CopyButton
              done="copied · run it in your terminal"
              text={add.text}
            />
          </>
        ) : null}
        {add.kind === "open" ? (
          <a className={chip} href={add.href}>
            <ExternalLink size={13} />
            {add.label}
          </a>
        ) : null}
      </StepLine>
      <StepLine index={2}>
        <p className="type-body text-muted-foreground m-0 pt-1">
          {agent.signIn}
        </p>
      </StepLine>
      <StepLine index={3}>
        <p className={cn(quote, "type-body m-0")} lang="zh-CN">
          {FIRST_ASK}
        </p>
        <CopyButton done="copied · ask your agent" text={FIRST_ASK} />
      </StepLine>
    </ol>
  );
}

function Onboarding({ url }: { url: string }) {
  const [picked, setPicked] = useState<AgentId>("claude");
  return (
    <div className="border-border grid gap-4 border-b py-3">
      <div className="flex flex-wrap gap-2">
        {AGENT_IDS.map((id) => (
          <Chip
            key={id}
            onSelect={setPicked}
            pressed={picked === id}
            value={id}
          >
            <Logo src={AGENTS[id].logo} />
            {AGENTS[id].name}
          </Chip>
        ))}
      </div>
      <Steps id={picked} url={url} />
    </div>
  );
}

function ConnectedAgent({
  agent,
  busy,
  onDisconnect,
}: {
  agent: Agent;
  busy: boolean;
  onDisconnect: (agent: Agent) => void;
}) {
  const disconnect = useCallback(
    () => onDisconnect(agent),
    [agent, onDisconnect]
  );
  const logo = logoOf(agent.name);
  return (
    <SettingRow
      id={`agent-${agent.clientId}`}
      note={`connected ${connectedOn(agent.connectedAt)}`}
      status="can edit your focus"
      title={
        <span className="inline-flex items-center gap-2">
          {logo ? <Logo src={logo} /> : null}
          {agent.name}
        </span>
      }
      tone="ok"
    >
      <ToolButton
        disabled={busy}
        icon={Unplug}
        onClick={disconnect}
        tone="danger"
      >
        disconnect
      </ToolButton>
    </SettingRow>
  );
}

/**
 * A learner's coding agent can choose what they learn next: put a class's words first, or drop
 * ones they don't need. It connects over MCP and signs in on /connect. Until one is connected,
 * the steps stay open; after, they wait behind "connect another".
 */
export function AgentSettings() {
  const { learner } = useSyncStatus();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  // An agent connects in another window; refetching on focus shows it when the learner is back.
  const query = useQuery({
    queryKey: agentsKey,
    queryFn: () => request(),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const disconnect = useMutation({
    mutationFn: (agent: Agent) => request({ disconnect: agent.clientId }),
    onSuccess: (next, agent) => {
      queryClient.setQueryData(agentsKey, next);
      toast(`${agent.name} disconnected`);
    },
    onError: () => toast("couldn’t disconnect · try again"),
  });
  const { mutate } = disconnect;
  const toggleAdding = useCallback(() => setAdding((open) => !open), []);

  const state = query.data;
  const agents = state?.agents ?? [];
  const [tone, status] = agentsStatus(
    query.isError,
    Boolean(learner),
    agents.length
  );
  const showSteps = Boolean(learner && state) && (!agents.length || adding);

  return (
    <>
      <SettingRow
        id="agent-heading"
        note="your coding agent can put a class's words first, add characters fluenc lacks, or drop words you don't need"
        status={status}
        title="choose what you learn next"
        tone={tone}
      >
        {agents.length ? (
          <Chip onClick={toggleAdding} pressed={adding}>
            connect another
          </Chip>
        ) : null}
      </SettingRow>
      {showSteps && state ? <Onboarding url={state.mcpUrl} /> : null}
      {agents.map((agent) => (
        <ConnectedAgent
          agent={agent}
          busy={disconnect.isPending}
          key={agent.clientId}
          onDisconnect={mutate}
        />
      ))}
    </>
  );
}
