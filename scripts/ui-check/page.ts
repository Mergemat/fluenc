// What runs inside the page. Each function is passed to `page.evaluate`, so it is self-contained.

/** Let loading finish, then hold every animation still: finite ones at their end, loops at 0. */
export async function settle() {
  await document.fonts.ready;
  const frame = () => new Promise((done) => requestAnimationFrame(done));
  for (let round = 0; round < 3; round += 1) {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getComputedTiming();
      if (timing?.iterations === Number.POSITIVE_INFINITY) {
        animation.pause();
        animation.currentTime = 0;
      } else {
        try {
          animation.finish();
        } catch {
          animation.cancel();
        }
      }
    }
    // biome-ignore lint/performance/noAwaitInLoops: each round waits for the frames the last one caused.
    await frame();
    await frame();
  }
}

export interface Capture {
  elements: {
    path: string;
    label: string;
    /** Value index per property, in `properties` order; pseudo-elements follow by name. */
    style: number[];
    pseudo: Record<string, number[]>;
    rect: [number, number, number, number];
    /** Whether it renders a box at all; inside `display: none` it doesn't. */
    rendered: boolean;
    parentDisplay: string;
  }[];
  properties: string[];
  /** Every computed value seen, indexed by the numbers in `elements`. */
  strings: string[];
}

/** Computed style and box of every element in the document, keyed by its place in the tree. */
export function captureStyles(): Capture {
  const strings: string[] = [];
  const index = new Map<string, number>();
  const intern = (value: string) => {
    let at = index.get(value);
    if (at === undefined) {
      at = strings.length;
      strings.push(value);
      index.set(value, at);
    }
    return at;
  };

  // Colours print differently by the space they were mixed in; compare what reaches the screen.
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const colours = new Map<string, string>();
  const toHex = (colour: string) => {
    let hex = colours.get(colour);
    if (hex === undefined && context) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "#000";
      context.fillStyle = colour;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      hex = `#${[r, g, b, a].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
      colours.set(colour, hex);
    }
    return hex ?? colour;
  };
  const COLOUR =
    /(?:rgba?|hsla?|oklab|oklch|lab|lch|color)\((?:[^()]|\([^()]*\))*\)/g;
  const normalise = (value: string) =>
    value.includes("(") ? value.replace(COLOUR, toHex) : value;

  const properties = [...getComputedStyle(document.documentElement)].filter(
    (name) => !name.startsWith("--")
  );
  const read = (style: CSSStyleDeclaration) =>
    properties.map((name) => intern(normalise(style.getPropertyValue(name))));

  const elements: Capture["elements"] = [];
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one self-contained function, as page.evaluate needs.
  const walk = (element: Element, path: string) => {
    const box = element.getBoundingClientRect();
    const pseudo: Record<string, number[]> = {};
    for (const name of [
      "::before",
      "::after",
      "::placeholder",
      "::backdrop",
      "::marker",
    ]) {
      const style = getComputedStyle(element, name);
      const content = style.getPropertyValue("content");
      // Placeholders, backdrops and markers exist without content; ::before and ::after need it.
      const drawn: Record<string, () => boolean> = {
        "::placeholder": () => element.matches("input, textarea"),
        "::backdrop": () => element.matches("dialog[open]"),
        "::marker": () =>
          style.getPropertyValue("display") !== "none" &&
          element.matches("li, summary"),
      };
      const relevant =
        drawn[name]?.() ?? (content !== "none" && content !== "normal");
      if (relevant) {
        pseudo[name] = read(style);
      }
    }
    const classes =
      typeof element.className === "string" ? element.className : "";
    const text =
      element.children.length === 0
        ? (element.textContent ?? "").trim().slice(0, 24)
        : "";
    elements.push({
      path,
      rendered: element.checkVisibility(),
      parentDisplay: element.parentElement
        ? getComputedStyle(element.parentElement).display
        : "block",
      label: `${element.tagName.toLowerCase()}${classes ? `.${classes.split(" ").filter(Boolean).slice(0, 4).join(".")}` : ""}${text ? ` "${text}"` : ""}`,
      style: read(getComputedStyle(element)),
      pseudo,
      rect: [box.x, box.y, box.width, box.height].map(
        (n) => Math.round(n * 10) / 10
      ) as Capture["elements"][number]["rect"],
    });
    let child = 0;
    for (const next of element.children) {
      if (
        next.tagName === "SCRIPT" ||
        next.tagName === "STYLE" ||
        next.tagName === "LINK"
      ) {
        continue;
      }
      walk(next, `${path}/${child}`);
      child += 1;
    }
  };
  walk(document.documentElement, "0");
  return { strings, properties, elements };
}

/** Pixels that differ between two PNGs, with a picture of where. */
export async function diffImages([a, b]: [string, string]) {
  const load = (src: string) =>
    new Promise<HTMLImageElement>((done, fail) => {
      const image = new Image();
      image.onload = () => done(image);
      image.onerror = fail;
      image.src = src;
    });
  const [left, right] = await Promise.all([load(a), load(b)]);
  const width = Math.max(left.width, right.width);
  const height = Math.max(left.height, right.height);
  const pixels = (image: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height);
  };
  const one = pixels(left);
  const two = pixels(right);
  const out = new ImageData(width, height);
  let changed = 0;
  for (let i = 0; i < one.data.length; i += 4) {
    let delta = 0;
    for (let c = 0; c < 4; c += 1) {
      delta = Math.max(delta, Math.abs(one.data[i + c] - two.data[i + c]));
    }
    const grey =
      one.data[i] * 0.3 + one.data[i + 1] * 0.59 + one.data[i + 2] * 0.11;
    if (delta > 2) {
      changed += 1;
      out.data.set([255, 0, 80, 255], i);
    } else {
      out.data.set([grey * 0.35, grey * 0.35, grey * 0.35, 255], i);
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  (canvas.getContext("2d") as CanvasRenderingContext2D).putImageData(out, 0, 0);
  return {
    changed,
    sizeMatches: left.width === right.width && left.height === right.height,
    diff: changed ? canvas.toDataURL("image/png") : null,
  };
}
