import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAnalyzer, distanceKm, inPolygon } from "../geo-analysis.mjs";

const countries = JSON.parse(await readFile(new URL("../assets/countries-50m.geojson", import.meta.url)));
const places = JSON.parse(await readFile(new URL("../assets/places-50m.json", import.meta.url)));
const analyze = createAnalyzer(countries, places);

test("matches known locations against the bundled country boundaries", () => {
  for (const [coordinates, expected] of [
    [[-78.45575157, -0.00211321], "Ecuador"],
    [[17.1077, 48.1486], "Slovakia"],
    [[2.3522, 48.8566], "France"],
    [[151.2093, -33.8688], "Australia"],
    [[178, -17.8], "Fiji"],
    [[-179.1, 66.3], "Russia"],
    [[0, -85], "Antarctica"],
  ]) assert.equal(analyze(coordinates).country, expected);
});

test("outside mapped land remains unmatched, without claiming the nearest city contains the point", () => {
  const result = analyze([-130, 0]);
  assert.equal(result.country, null);
  assert.equal(result.countryCode, null);
  assert.ok(result.nearestPlace);
  assert.ok(result.nearestPlaceDistanceKm > 1000);
});

test("nearest city is selected by great-circle distance", () => {
  const result = analyze([17.1077, 48.1486]);
  assert.equal(result.nearestPlace, "Bratislava");
  assert.ok(result.nearestPlaceDistanceKm < 5);
  const place = places.find((p) => p.name === "Quito");
  assert.equal(analyze(place.coordinates).nearestPlaceDistanceKm, 0);
});

test("distance works across the antimeridian, at the poles, and at antipodes", () => {
  assert.ok(Math.abs(distanceKm([179, 0], [-179, 0]) - 222.39) < 0.1);
  assert.ok(distanceKm([180, 90], [-180, 90]) < 0.000001);
  assert.ok(Math.abs(distanceKm([0, 0], [180, 0]) - 20015.11) < 0.1);
  assert.equal(distanceKm([17, 48], [17, 48]), 0);
});

test("country intersection respects polygon holes, islands, and edges", () => {
  const outer = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const hole = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]];
  assert.equal(inPolygon([1, 1], [outer, hole]), true);
  assert.equal(inPolygon([5, 5], [outer, hole]), false);
  assert.equal(inPolygon([0, 5], [outer]), true);
  assert.equal(inPolygon([20, 5], [outer]), false);
  const custom = createAnalyzer({ features: [{ properties: { name: "Islands", code: "ISL" },
    geometry: { type: "MultiPolygon", coordinates: [[outer, hole], [[[20, 0], [22, 0], [22, 2], [20, 2], [20, 0]]]] } }] }, places);
  assert.equal(custom([21, 1]).country, "Islands");
  assert.equal(custom([5, 5]).country, null);
});

test("both representations of the date line give the same result", () => {
  assert.deepEqual(analyze([180, -85]), analyze([-180, -85]));
});
