/**
 * Open-Meteo: turning "Lisbon in March" into numbers you can pack from.
 *
 * Open-Meteo has no normals endpoint. The Climate API looks like the right
 * tool and isn't — it returns CMIP6 *model* output meant for projections to
 * 2050, and its Lisbon March rain-day count comes out at 10.2 against ERA5's
 * 8.2. So we average the reanalysis archive ourselves.
 *
 * Why one request per year rather than one spanning the whole range: the free
 * tier weights a call by how many days it covers, so a single 15-year pull
 * costs dozens of calls' worth of quota while fifteen month-sized slices cost
 * about two each.
 *
 * Attribution is required (CC BY 4.0): "Weather data by Open-Meteo.com".
 */

const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

/** How many past years to average. The WMO uses 30; 15 is within 0.2°C here
 *  and costs half the quota. Six years was out by 1.4°C, so don't go lower. */
const YEARS = 15;

/** A day counts as rainy at 1mm or more. Reanalysis drizzle makes anything
 *  lower meaningless — Singapore reads 23.7 wet days out of 31 at this
 *  threshold already. */
const RAIN_MM = 1;

export type Place = {
  lat: number;
  lon: number;
  /** "Lisbon, Portugal" */
  label: string;
  /** ISO alpha-2, for anything that keys on country later. */
  countryCode?: string;
};

export type Normals = {
  highC: number;
  lowC: number;
  rainDays: number;
  /** How many years actually contributed, after failures and gaps. */
  sampleYears: number;
};

/**
 * The API answered, but not usefully — rate-limited, 5xx, or unparseable.
 * Distinct from "no such place", which is a `null` return and a different
 * screen: one says "we can't reach the weather", the other "we don't know
 * that place".
 */
export class ClimateUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClimateUnavailable";
  }
}

/** Coordinates rounded to ~11km, which is what makes two spellings of the
 *  same city share one cached row. */
export function placeKey(lat: number, lon: number): string {
  return `${lat.toFixed(1)},${lon.toFixed(1)}`;
}

/** Last day of a 1-indexed month, so February never asks for the 31st. A
 *  naive `${year}-02-31` does NOT error — Open-Meteo rolls it into March and
 *  silently returns 31 days, quietly poisoning the average. */
function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (cause) {
    throw new ClimateUnavailable(`Could not reach Open-Meteo: ${String(cause)}`);
  }

  if (!response.ok) {
    throw new ClimateUnavailable(`Open-Meteo returned ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ClimateUnavailable("Open-Meteo returned something that wasn't JSON");
  }

  /* Errors arrive as HTTP 200 with `error: true` as often as they arrive as a
     4xx, so the status alone is not the signal. This is also where the two
     429 shapes land — "Minutely API request limit exceeded" and "Too many
     concurrent requests". */
  if (typeof body === "object" && body !== null && "error" in body) {
    const reason = (body as { reason?: string }).reason ?? "unknown error";
    throw new ClimateUnavailable(reason);
  }

  return body;
}

/**
 * Resolve a typed destination to coordinates.
 *
 * Returns null when nothing matched. Note the shape that means "nothing":
 * Open-Meteo answers HTTP 200 with `{"generationtime_ms": 0.04}` and **no
 * `results` key at all** — not an empty array. Checking `results.length`
 * throws; checking `res.ok` passes.
 */
export async function geocode(name: string): Promise<Place | null> {
  const query = name.trim();
  if (query.length < 2) return null;

  const body = (await getJson(
    `${GEOCODE}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
  )) as {
    results?: {
      latitude: number;
      longitude: number;
      name: string;
      country?: string;
      country_code?: string;
      admin1?: string;
    }[];
  };

  const hit = body.results?.[0];
  if (!hit) return null;

  return {
    lat: hit.latitude,
    lon: hit.longitude,
    label: [hit.name, hit.country].filter(Boolean).join(", "),
    countryCode: hit.country_code,
  };
}

type DailyBlock = {
  daily?: {
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_sum?: (number | null)[];
  };
};

/**
 * Average one month across the last `YEARS` complete years.
 *
 * Requests run **strictly one at a time**. Ten in parallel got five of them
 * refused with "Too many concurrent requests"; the sequential version took
 * about 14 seconds for 30 years and failed nothing. Slow and reliable beats
 * fast and half-empty, especially behind a cache that makes this run once.
 *
 * A year that fails is skipped rather than fatal — `sampleYears` records how
 * many actually counted. Only a total wipeout throws.
 */
export async function fetchNormals(
  lat: number,
  lon: number,
  month: number,
): Promise<Normals> {
  const endYear = new Date().getUTCFullYear() - 1;
  const highs: number[] = [];
  const lows: number[] = [];
  const wetDaysPerYear: number[] = [];
  let lastFailure: unknown;

  for (let year = endYear - YEARS + 1; year <= endYear; year++) {
    const mm = String(month).padStart(2, "0");
    const start = `${year}-${mm}-01`;
    const end = `${year}-${mm}-${String(lastDay(year, month)).padStart(2, "0")}`;

    let block: DailyBlock;
    try {
      block = (await getJson(
        `${ARCHIVE}?latitude=${lat}&longitude=${lon}` +
          `&start_date=${start}&end_date=${end}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
          `&timezone=auto`,
      )) as DailyBlock;
    } catch (error) {
      lastFailure = error;
      continue;
    }

    const daily = block.daily;
    if (!daily) continue;

    for (const value of daily.temperature_2m_max ?? []) {
      if (value !== null && value !== undefined) highs.push(value);
    }
    for (const value of daily.temperature_2m_min ?? []) {
      if (value !== null && value !== undefined) lows.push(value);
    }

    const wet = (daily.precipitation_sum ?? []).filter(
      (mmRain) => mmRain !== null && mmRain !== undefined && mmRain >= RAIN_MM,
    ).length;
    wetDaysPerYear.push(wet);
  }

  if (highs.length === 0 || lows.length === 0) {
    throw new ClimateUnavailable(
      `No usable archive data for ${lat},${lon} month ${month}` +
        (lastFailure ? ` (last error: ${String(lastFailure)})` : ""),
    );
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    highC: round1(mean(highs)),
    lowC: round1(mean(lows)),
    rainDays: round1(mean(wetDaysPerYear)),
    sampleYears: wetDaysPerYear.length,
  };
}
