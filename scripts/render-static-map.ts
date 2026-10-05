// Renders the static location map for /besuch/ (AC-8, spec D13: no live map
// embed, so the page makes no third-party request and needs no cookie
// banner). It fetches the few OpenStreetMap standard tiles around the
// location, stitches them with the ImageMagick `magick` CLI, draws a marker
// and burns in the attribution. A dev tool, not part of the build or CI;
// rerun it when the location or the size changes:
//   node scripts/render-static-map.ts
//
// OSM tile usage policy (https://operations.osmfoundation.org/policies/tiles/):
// a descriptive User-Agent, no bulk downloads, so the tiles are fetched one
// after another and the script refuses to fetch more than MAX_TILES.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Lettberger Str. 95, 12355 Berlin, geocoded once with Nominatim
// (nominatim.openstreetmap.org, OSM node 3029797102, "Rudow, Neukölln").
const CENTER = { lat: 52.4109527, lon: 13.521042 };
// Zoom 16 shows the surrounding main roads; 1200×700 at zoom 17 would need
// 24 tiles.
const ZOOM = 16;
const WIDTH = 1200;
const HEIGHT = 700;
// JPEG: a quarter of the PNG's size for this map.
const OUTPUT = "src/assets/images/karte-berlin.jpg";

const TILE_SIZE = 256;
const MAX_TILES = 20;
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const USER_AGENT =
  "baumschule-fischer-static-map/1.0 (one-off render for a static site; https://github.com/ifahrentholz/baumschule)";
const ATTRIBUTION = "© OpenStreetMap-Mitwirkende";

/** The location in global pixel coordinates at `zoom` (Web Mercator). */
function toPixels(lat: number, lon: number, zoom: number) {
  const size = TILE_SIZE * 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * size,
    y:
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      size,
  };
}

const center = toPixels(CENTER.lat, CENTER.lon, ZOOM);
const left = Math.round(center.x - WIDTH / 2);
const top = Math.round(center.y - HEIGHT / 2);
const firstX = Math.floor(left / TILE_SIZE);
const lastX = Math.floor((left + WIDTH - 1) / TILE_SIZE);
const firstY = Math.floor(top / TILE_SIZE);
const lastY = Math.floor((top + HEIGHT - 1) / TILE_SIZE);
const tileCount = (lastX - firstX + 1) * (lastY - firstY + 1);
if (tileCount > MAX_TILES) {
  throw new Error(
    `${WIDTH}×${HEIGHT} at zoom ${ZOOM} needs ${tileCount} tiles, more than ${MAX_TILES}`,
  );
}

// ImageMagick's built-in default font is a serif; ask fontconfig instead.
const font = execFileSync("fc-match", ["-f", "%{file}", "sans-serif"], {
  encoding: "utf8",
});

const dir = mkdtempSync(join(tmpdir(), "static-map-"));
try {
  const rows: string[][] = [];
  for (let y = firstY; y <= lastY; y++) {
    const row: string[] = [];
    for (let x = firstX; x <= lastX; x++) {
      const url = TILE_URL.replace("{z}", String(ZOOM))
        .replace("{x}", String(x))
        .replace("{y}", String(y));
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      const file = join(dir, `${x}-${y}.png`);
      writeFileSync(file, Buffer.from(await response.arrayBuffer()));
      row.push(file);
    }
    rows.push(row);
  }

  const markerX = Math.round(center.x - left);
  const markerY = Math.round(center.y - top);
  execFileSync("magick", [
    ...rows.flatMap((row) => ["(", ...row, "+append", ")"]),
    "-append",
    "-crop",
    `${WIDTH}x${HEIGHT}+${left - firstX * TILE_SIZE}+${top - firstY * TILE_SIZE}`,
    "+repage",
    // Marker: a red dot with a white ring, readable on any map colour.
    "-fill",
    "#c0392b",
    "-stroke",
    "#ffffff",
    "-strokewidth",
    "4",
    "-draw",
    `circle ${markerX},${markerY} ${markerX + 14},${markerY}`,
    "-stroke",
    "none",
    "-fill",
    "#ffffff",
    "-draw",
    `circle ${markerX},${markerY} ${markerX + 4},${markerY}`,
    // Attribution (ODbL), bottom right on a light box.
    "-gravity",
    "southeast",
    "-font",
    font,
    "-pointsize",
    "16",
    "-fill",
    "#222222",
    "-undercolor",
    "#ffffffd9",
    "-annotate",
    "+0+0",
    ` ${ATTRIBUTION} `,
    "-strip",
    "-quality",
    "85",
    OUTPUT,
  ]);
  console.log(
    `${OUTPUT}: ${WIDTH}×${HEIGHT}, zoom ${ZOOM}, ${tileCount} tiles, centre ${CENTER.lat},${CENTER.lon}`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
