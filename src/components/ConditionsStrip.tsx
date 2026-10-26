import { toF } from "@/lib/climate";
/* Type-only, so this client component doesn't pull the fetching module into
   the browser bundle — the import is erased at compile time. */
import type { DayNormal } from "@/lib/open-meteo";
import { Badge } from "./Card";

/**
 * A row of day cells — one per day of the trip, with what that date is usually
 * like.
 *
 * This replaces a sentence about the month with the days you're actually going.
 * "Cold, 31–44°F, some rain" is true of December in New York and tells you
 * nothing about whether to pack for the 10th differently from the 17th; a strip
 * shows the shape of the week, which is what you pack from.
 *
 * Every figure is a normal, not a forecast — the average of that calendar date
 * across fifteen years. That matters for how it's labelled: these are "usually"
 * numbers, and the header says so once rather than repeating it per cell.
 */

/** Printed, not glossy: hairline strokes in ink, no fill, no colour. */
function Glyph({ kind }: { kind: Weather }) {
  const stroke = "currentColor";
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "snow") {
    return (
      <svg {...common}>
        <path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" />
      </svg>
    );
  }
  if (kind === "rain") {
    return (
      <svg {...common}>
        <path d="M6 14a4 4 0 0 1 .8-7.9 5.5 5.5 0 0 1 10.5 1.6A3.5 3.5 0 0 1 17 14H6z" />
        <path d="M9 17.5l-1 3M13 17.5l-1 3M17 17.5l-1 3" />
      </svg>
    );
  }
  if (kind === "cloud") {
    return (
      <svg {...common}>
        <path d="M6 17a4 4 0 0 1 .8-7.9 5.5 5.5 0 0 1 10.5 1.6A3.5 3.5 0 0 1 17 17H6z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </svg>
  );
}

export type Weather = "sun" | "cloud" | "rain" | "snow";

/**
 * One glyph per day, from the two numbers we have.
 *
 * Thresholds are deliberately coarse. The underlying figure is "4 of the last
 * 15 December 10ths were wet", and pretending that supports finer gradations
 * than wet / unsettled / dry would be false precision.
 *
 * Snow is judged on the **mean of high and low**, not the low alone. The first
 * version used `lowC <= 0` and painted five snowflakes across a mid-December
 * week in New York, which is plainly wrong — the lows there sit a degree below
 * freezing while the highs are 6–8°C, so precipitation almost always arrives as
 * rain. The overnight minimum says nothing about the temperature when it
 * actually fell; the day's midpoint is a far better proxy.
 */
export function weatherFor(day: DayNormal): Weather {
  const mean = (day.highC + day.lowC) / 2;
  if (day.wetChance >= 0.3 && mean <= 1) return "snow";
  if (day.wetChance >= 0.4) return "rain";
  if (day.wetChance >= 0.2) return "cloud";
  return "sun";
}

const WEATHER_LABEL: Record<Weather, string> = {
  sun: "mostly dry",
  cloud: "some chance of rain",
  rain: "often wet",
  snow: "often wet, and cold enough to snow",
};

/**
 * A pigment per kind of day, in the same spirit as `categoryStyle.ts`: a
 * limited ink set a printed chart would plausibly have had, kept well away from
 * the accent, which belongs to the primary action alone.
 *
 * `hue` draws the glyph, `tint` washes the cell — so the strip can be read at a
 * glance without anyone parsing percentages. The tints are deliberately faint;
 * nine saturated cells in a row would be the fruit salad the category comment
 * warns about.
 */
const WEATHER_STYLE: Record<Weather, { hue: string; tint: string }> = {
  sun: { hue: "#8A6A1E", tint: "#F3EAD1" },
  cloud: { hue: "#595F69", tint: "#E6E7EA" },
  rain: { hue: "#2F5570", tint: "#DCE4EC" },
  snow: { hue: "#4A6E7A", tint: "#DFEAEE" },
};

export type TripDay = {
  /** The real calendar date, for the label. */
  date: Date;
  normal: DayNormal;
};

export function ConditionsStrip({
  days,
  sampleYears,
  place,
}: {
  days: TripDay[];
  sampleYears: number;
  place: string;
}) {
  if (days.length === 0) return null;

  return (
    <section className="mt-3" aria-labelledby="conditions-strip-heading">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Badge>Usually</Badge>
        {/* The legend lives here, once, rather than as HI/LO on every cell.
            Said in the header it costs five words total; said per cell it costs
            four characters of chrome nine times over. */}
        <h2 id="conditions-strip-heading" className="text-small text-muted">
          What these dates are typically like in {place.split(",")[0]}, averaged
          from {sampleYears} years — <strong className="text-ink">daytime high</strong>{" "}
          and overnight low.{" "}
          <a href="https://open-meteo.com" rel="noreferrer noopener">
            Open-Meteo
          </a>
        </h2>
      </div>

      {/* Scrolls rather than wraps: a fortnight shouldn't reflow into a block
          that reads like a table. Hairline rules between cells, no fills —
          Café Terrace is a printed document, not a weather app. */}
      <ol className="mt-2 flex overflow-x-auto border border-rule bg-surface">
        {days.map(({ date, normal }) => {
          const kind = weatherFor(normal);
          const style = WEATHER_STYLE[kind];
          return (
            <li
              key={date.toISOString()}
              /* gap-2 and py-3 keep to the 4px scale the design system
                 specifies — gap-1.5 would be 6px, which isn't on it. */
              className="flex min-w-18 flex-1 flex-col items-center gap-2 border-r border-rule px-2 py-3 last:border-r-0"
              style={{ backgroundColor: style.tint }}
            >
              {/* Weekday and date on ONE line, in label type.

                  They were two lines before, which left a bare "10" sitting in
                  the same size and colour as the temperatures below it — three
                  numbers in one visual register, and no way to tell which was a
                  date. Uppercase letterspaced type is the one style in Café
                  Terrace that unmistakably isn't a measurement. */}
              <span className="font-sans text-label uppercase tracking-[0.14em] text-muted">
                {date.toLocaleDateString(undefined, { weekday: "short" })}{" "}
                {date.getDate()}
              </span>

              <span style={{ color: style.hue }} title={WEATHER_LABEL[kind]}>
                <Glyph kind={kind} />
                <span className="sr-only">{WEATHER_LABEL[kind]}</span>
              </span>

              {/* High and low, baseline-aligned with a clear size step.

                  Size is what names them: the larger figure is the day, the
                  smaller the night. Stacked at equal size, "46" over "34" only
                  said "two numbers, one above the other" — the reader had to
                  infer the relationship. Labelling them HI and LO would be the
                  obvious fix and the wrong one; it adds four characters of
                  chrome per cell to say what a size step already says. */}
              <span className="flex items-baseline gap-1">
                <span className="font-sans text-body font-semibold tabular-nums text-ink">
                  {toF(normal.highC)}°
                </span>
                <span className="font-sans text-label tabular-nums text-muted">
                  {toF(normal.lowC)}°
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
