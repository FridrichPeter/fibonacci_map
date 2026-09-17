import * as maplibregl from "https://unpkg.com/maplibre-gl@6.9.1/dist/maplibre-gl.mjs";
import { createAnalyzer } from "./geo-analysis.mjs";

const DEFAULT_ORIGIN = [-78.45575156968523, -0.002113206204556048];
const GOLDEN_ANGLE = 137.507764;
const EARTH_RADIUS_KM = 6371.0088;

const state = {
  angle: GOLDEN_ANGLE,
  count: 18,
  reachKm: 4000,
  visibleCount: 18,
  isPlaying: false,
  timer: null,
  features: [],
  origin: [...DEFAULT_ORIGIN],
  originName: "Mitad del Mundo",
  isChoosingOrigin: false,
  geometryKey: null,
  analyzer: null,
  analysisStatus: "loading",
  selectedIndex: null,
};

const elements = {
  angleValue: document.querySelector("#angleValue"),
  pointCount: document.querySelector("#pointCount"),
  pointCountValue: document.querySelector("#pointCountValue"),
  reach: document.querySelector("#reach"),
  reachValue: document.querySelector("#reachValue"),
  play: document.querySelector("#play"),
  playIcon: document.querySelector(".play-icon"),
  playLabel: document.querySelector(".play-label"),
  download: document.querySelector("#download"),
  cleanView: document.querySelector("#cleanView"),
  shareView: document.querySelector("#shareView"),
  selectOrigin: document.querySelector("#selectOrigin"),
  resetOrigin: document.querySelector("#resetOrigin"),
  originCoordinates: document.querySelector("#originCoordinates"),
  originName: document.querySelector("#originName"),
  sequence: document.querySelector("#sequence"),
  sequenceProgress: document.querySelector("#sequenceProgress"),
  largestTerm: document.querySelector("#largestTerm"),
  spatialRule: document.querySelector("#spatialRule"),
  loading: document.querySelector("#loading"),
  toast: document.querySelector("#toast"),
  analysisPanel: document.querySelector("#analysisPanel"),
  analysisList: document.querySelector("#analysisList"),
  analysisSummary: document.querySelector("#analysisSummary"),
  toggleAnalysis: document.querySelector("#toggleAnalysis"),
  closeAnalysis: document.querySelector("#closeAnalysis"),
  retryAnalysis: document.querySelector("#retryAnalysis"),
};

function fibonacci(count) {
  const values = [];
  let a = 0;
  let b = 1;

  for (let index = 0; index < count; index += 1) {
    values.push(b);
    [a, b] = [b, a + b];
  }

  return values;
}

function destinationPoint([longitude, latitude], bearingDegrees, distanceKm) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitude1 = (latitude * Math.PI) / 180;
  const longitude1 = (longitude * Math.PI) / 180;

  const latitude2 = Math.asin(
    Math.sin(latitude1) * Math.cos(angularDistance) +
      Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const longitude2 =
    longitude1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1),
      Math.cos(angularDistance) - Math.sin(latitude1) * Math.sin(latitude2),
    );

  const normalizedLongitude =
    (((longitude2 * 180) / Math.PI + 540) % 360) - 180;
  return [normalizedLongitude, (latitude2 * 180) / Math.PI];
}

function buildFeatures() {
  const key = JSON.stringify([state.origin, state.count, state.reachKm, state.angle]);
  if (key === state.geometryKey) return;
  state.geometryKey = key;
  state.selectedIndex = null;
  popup.remove();
  const values = fibonacci(state.count);
  const maximum = values.at(-1);

  state.features = values.map((value, index) => {
    const distanceKm =
      index === 0 ? 0 : state.reachKm * Math.sqrt(value / maximum);
    const bearing = (index * state.angle) % 360;
    const coordinates =
      index === 0
        ? state.origin
        : destinationPoint(state.origin, bearing, distanceKm);

    return {
      type: "Feature",
      geometry: { type: "Point", coordinates },
      properties: {
        index: index + 1,
        value,
        distanceKm: Math.round(distanceKm),
        bearing: Number(bearing.toFixed(1)),
        lat: coordinates[1],
        lon: coordinates[0],
        analysisStatus: state.analysisStatus,
        ...(state.analyzer ? state.analyzer(coordinates) : {}),
      },
    };
  });
  buildAnalysisRows();
}

function placeLabel(properties) {
  if (properties.analysisStatus === "loading") return "Loading place…";
  if (properties.analysisStatus === "error") return "Place data unavailable";
  return properties.country || "Open water / unmapped land";
}

function nearestLabel(properties) {
  if (properties.analysisStatus !== "ready") return "Coordinates available below";
  const distance = properties.nearestPlaceDistanceKm.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return `Nearest mapped city: ${properties.nearestPlace}, ${properties.nearestPlaceCountry} · ${distance} km`;
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function buildAnalysisRows() {
  elements.analysisList.replaceChildren(...state.features.map(({ properties: p }) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "analysis-row";
    row.dataset.index = p.index;
    row.setAttribute("aria-label", `Explore Fibonacci term ${p.index}, ${placeLabel(p)}, latitude ${p.lat.toFixed(5)}, longitude ${p.lon.toFixed(5)}`);
    row.append(
      textElement("span", "term-badge", `F${p.index}`),
      textElement("span", "term-number", p.value.toLocaleString("en-US")),
      textElement("span", "term-place", placeLabel(p)),
      textElement("span", "term-nearest", nearestLabel(p)),
    );
    const coordinates = textElement("span", "term-coordinates", "");
    coordinates.append(
      textElement("span", "", `LAT ${p.lat.toFixed(5)}°`),
      textElement("span", "", `LON ${p.lon.toFixed(5)}°`),
    );
    row.append(coordinates);
    return row;
  }));
  const countries = new Set(state.features.map((f) => f.properties.countryCode).filter(Boolean));
  const outside = state.features.filter((f) => !f.properties.countryCode).length;
  elements.analysisSummary.textContent = state.analysisStatus === "ready"
    ? `${state.count} points · ${countries.size} countries / territories · ${outside} outside mapped land`
    : state.analysisStatus === "error"
      ? "Geography could not load. All coordinates are still available."
      : "Loading geography… Coordinates are ready.";
  elements.retryAnalysis.hidden = state.analysisStatus !== "error";
}

async function loadGeography() {
  state.analysisStatus = "loading";
  state.geometryKey = null;
  render();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const [countries, places] = await Promise.all([
      "./assets/countries-50m.geojson", "./assets/places-50m.json",
    ].map(async (url) => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Geography HTTP ${response.status}`);
      return response.json();
    }));
    state.analyzer = createAnalyzer(countries, places);
    state.analysisStatus = "ready";
  } catch (error) {
    controller.abort();
    state.analysisStatus = "error";
    console.error("Could not load local geography", error);
  } finally {
    window.clearTimeout(timeout);
    state.geometryKey = null;
    render();
  }
}

function setAnalysisOpen(open) {
  elements.analysisPanel.hidden = !open;
  elements.toggleAnalysis.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("analysis-open", open);
}

function showPointPopup(feature) {
  const p = feature.properties;
  const content = document.createElement("div");
  content.append(
    textElement("div", "popup-kicker", `Fibonacci term ${p.index}`),
    textElement("div", "popup-value", p.value.toLocaleString("en-US")),
    textElement("div", "popup-place", placeLabel(p)),
    textElement("div", "popup-meta", nearestLabel(p)),
    textElement("div", "popup-coordinates", `LAT ${p.lat.toFixed(5)}° · LON ${p.lon.toFixed(5)}°`),
    textElement("div", "popup-meta", `${p.distanceKm.toLocaleString("en-US")} km from origin · ${p.bearing}° bearing`),
  );
  popup.setLngLat(feature.geometry.coordinates).setDOMContent(content).addTo(map);
}

function focusTerm(index) {
  if (state.isChoosingOrigin) return;
  const feature = state.features[index - 1];
  if (!feature || !map.getSource("fibonacci-points")) return;
  stopAnimation();
  state.visibleCount = state.count;
  state.selectedIndex = index;
  render();
  // On narrow screens leave the map visible after choosing a result.
  const compact = window.matchMedia("(max-width: 1100px)").matches;
  if (compact) {
    setAnalysisOpen(false);
    document.body.classList.add("point-focused");
  }
  const analysisOpen = !elements.analysisPanel.hidden;
  map.easeTo({
    center: feature.geometry.coordinates,
    zoom: Math.max(map.getZoom(), 5),
    padding: compact ? { top: 110, bottom: 100, left: 20, right: 20 }
      : { top: 170, bottom: 110, left: 430, right: analysisOpen ? 410 : 30 },
    retainPadding: false,
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800,
  });
  showPointPopup(feature);
}

function pointCollection(visibleCount = state.visibleCount) {
  return {
    type: "FeatureCollection",
    features: state.features.slice(0, visibleCount),
  };
}

function lineCollection(visibleCount = state.visibleCount) {
  const visible = state.features.slice(0, visibleCount);
  const path =
    visible.length > 1
      ? [
          {
            type: "Feature",
            properties: { kind: "path" },
            geometry: {
              type: "LineString",
              coordinates: visible.map(
                (feature) => feature.geometry.coordinates,
              ),
            },
          },
        ]
      : [];
  const spokes = visible.slice(1).map((feature) => ({
    type: "Feature",
    properties: { kind: "spoke", index: feature.properties.index },
    geometry: {
      type: "LineString",
      coordinates: [state.origin, feature.geometry.coordinates],
    },
  }));

  return { type: "FeatureCollection", features: [...path, ...spokes] };
}

function updateSequenceUi() {
  const values = fibonacci(state.count);
  elements.sequence.replaceChildren(
    ...values.map((value, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.dataset.index = index + 1;
      chip.className = `sequence-chip${index < state.visibleCount ? " visible" : ""}`;
      chip.textContent = value.toLocaleString("en-US");
      chip.title = `F${index + 1} = ${value.toLocaleString("en-US")}`;
      chip.setAttribute("aria-label", `Explore ${chip.title}`);
      chip.setAttribute("aria-pressed", String(state.selectedIndex === index + 1));
      return chip;
    }),
  );
  elements.sequenceProgress.textContent = `${state.visibleCount} / ${state.count}`;
  elements.largestTerm.textContent = values.at(-1).toLocaleString("en-US");
}

function updateLabels() {
  const isGolden = Math.abs(state.angle - GOLDEN_ANGLE) < 0.01;
  elements.angleValue.textContent = isGolden ? "137.5°" : `${state.angle}°`;
  elements.pointCountValue.textContent = `${state.count} points`;
  elements.reachValue.textContent = `${state.reachKm.toLocaleString("en-US")} km`;
  elements.spatialRule.textContent = isGolden ? "Golden angle" : "45° rotation";
}

function formatOriginCoordinates([longitude, latitude]) {
  const latitudeDirection = latitude >= 0 ? "N" : "S";
  const longitudeDirection = longitude >= 0 ? "E" : "W";

  return (
    `${Math.abs(latitude).toFixed(4)}° ${latitudeDirection}, ` +
    `${Math.abs(longitude).toFixed(4)}° ${longitudeDirection}`
  );
}

function updateOriginUi() {
  elements.originName.textContent = state.originName;
  elements.originCoordinates.textContent = formatOriginCoordinates(
    state.origin,
  );
}

function setOrigin(coordinates, name = "Custom origin") {
  stopAnimation();

  state.origin = [...coordinates];
  state.originName = name;
  state.isChoosingOrigin = false;
  state.visibleCount = state.count;

  document.body.classList.remove("map-selecting");
  elements.selectOrigin.textContent = "Choose on map";
  map.getCanvas().style.cursor = "";

  render();
  updateUrl();
}

function render() {
  buildFeatures();
  updateLabels();
  updateOriginUi();
  updateSequenceUi();
  elements.analysisList.querySelectorAll(".analysis-row").forEach((row) => {
    row.classList.toggle("pending", Number(row.dataset.index) > state.visibleCount);
    row.setAttribute("aria-pressed", String(Number(row.dataset.index) === state.selectedIndex));
  });

  if (!map.getSource("fibonacci-points")) return;
  map.getSource("fibonacci-points").setData(pointCollection());
  map.getSource("fibonacci-lines").setData(lineCollection());
  map.setFilter("fibonacci-selected", ["==", ["get", "index"], state.selectedIndex ?? -1]);
}

function stopAnimation() {
  window.clearInterval(state.timer);
  state.timer = null;
  state.isPlaying = false;
  elements.playIcon.textContent = "▶";
  elements.playLabel.textContent = "Play sequence";
}

function playAnimation() {
  stopAnimation();
  state.selectedIndex = null;
  popup.remove();
  state.visibleCount = 1;
  state.isPlaying = true;
  elements.playIcon.textContent = "Ⅱ";
  elements.playLabel.textContent = "Pause";
  render();

  state.timer = window.setInterval(() => {
    state.visibleCount += 1;
    render();

    if (state.visibleCount >= state.count) stopAnimation();
  }, 360);
}

function togglePlayback() {
  if (state.isPlaying) {
    stopAnimation();
  } else {
    playAnimation();
  }
}

function updateUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set(
    "angle",
    Math.abs(state.angle - GOLDEN_ANGLE) < 0.01 ? "golden" : "45",
  );
  url.searchParams.set("points", String(state.count));
  url.searchParams.set("reach", String(state.reachKm));

  const [longitude, latitude] = state.origin;
  const isDefaultOrigin =
    Math.abs(longitude - DEFAULT_ORIGIN[0]) < 0.000001 &&
    Math.abs(latitude - DEFAULT_ORIGIN[1]) < 0.000001;

  if (isDefaultOrigin) {
    url.searchParams.delete("lng");
    url.searchParams.delete("lat");
  } else {
    url.searchParams.set("lng", longitude.toFixed(6));
    url.searchParams.set("lat", latitude.toFixed(6));
  }

  window.history.replaceState({}, "", url);
  return url;
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  const pointCount = Number(params.get("points"));
  const reachKm = Number(params.get("reach"));
  const angle = params.get("angle");

  if (Number.isInteger(pointCount) && pointCount >= 8 && pointCount <= 22)
    state.count = pointCount;
  if (Number.isFinite(reachKm) && reachKm >= 500 && reachKm <= 8000)
    state.reachKm = reachKm;
  if (angle === "45") state.angle = 45;

  if (params.has("lng") && params.has("lat")) {
    const longitude = Number(params.get("lng"));
    const latitude = Number(params.get("lat"));

    if (
      Number.isFinite(longitude) &&
      Number.isFinite(latitude) &&
      longitude >= -180 &&
      longitude <= 180 &&
      latitude >= -90 &&
      latitude <= 90
    ) {
      state.origin = [longitude, latitude];
      state.originName = "Custom origin";
    }
  }

  state.visibleCount = state.count;
  elements.pointCount.value = state.count;
  elements.reach.value = state.reachKm;
  document.querySelectorAll("[data-angle]").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.angle) === state.angle,
    );
  });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function downloadGeoJson() {
  const payload = {
    type: "FeatureCollection",
    name: "fibonacci_earth_lab",
    metadata: {
      origin: {
        name: state.originName,
        coordinates: state.origin,
      },
      rotationDegrees: state.angle,
      maximumReachKm: state.reachKm,
      generatedAt: new Date().toISOString(),
      analysis: {
        status: state.analysisStatus,
        source: "Natural Earth 1:50m countries and populated places",
        sourceUrl: "https://www.naturalearthdata.com/downloads/50m-cultural-vectors/",
        method: "Point-in-polygon country lookup and nearest mapped city by great-circle distance",
        scope: "Term points only; connecting lines are not analyzed. Boundaries are approximate and cities are a selected subset.",
        coordinateReferenceSystem: "WGS84; geometry [longitude, latitude]; properties lat/lon in decimal degrees",
      },
    },
    features: state.features,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/geo+json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "fibonacci-earth.geojson";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("GeoJSON downloaded");
}

applyUrlState();

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: state.origin,
  zoom: 2.45,
  minZoom: 1.25,
  maxZoom: 12,
  attributionControl: false,
  antialias: true,
});

map.addControl(
  new maplibregl.NavigationControl({ showCompass: true }),
  "bottom-right",
);
map.addControl(
  new maplibregl.AttributionControl({ compact: true }),
  "bottom-right",
);

map.on("load", () => {
  map.addSource("fibonacci-points", {
    type: "geojson",
    data: pointCollection(),
  });
  map.addSource("fibonacci-lines", { type: "geojson", data: lineCollection() });

  map.addLayer({
    id: "fibonacci-spokes",
    type: "line",
    source: "fibonacci-lines",
    filter: ["==", ["get", "kind"], "spoke"],
    paint: {
      "line-color": "#5df2bb",
      "line-width": 0.8,
      "line-opacity": 0.18,
      "line-dasharray": [2, 4],
    },
  });

  map.addLayer({
    id: "fibonacci-path",
    type: "line",
    source: "fibonacci-lines",
    filter: ["==", ["get", "kind"], "path"],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": [
        "interpolate",
        ["linear"],
        ["zoom"],
        1,
        "#47d7e8",
        7,
        "#b9ff66",
      ],
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.2, 7, 3.5],
      "line-opacity": 0.68,
      "line-blur": 0.3,
    },
  });

  map.addLayer({
    id: "fibonacci-glow",
    type: "circle",
    source: "fibonacci-points",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["get", "index"],
        1,
        14,
        22,
        28,
      ],
      "circle-color": "#5df2bb",
      "circle-opacity": 0.13,
      "circle-blur": 0.75,
    },
  });

  map.addLayer({
    id: "fibonacci-points",
    type: "circle",
    source: "fibonacci-points",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["get", "index"],
        1,
        4.5,
        22,
        9,
      ],
      "circle-color": [
        "interpolate",
        ["linear"],
        ["get", "index"],
        1,
        "#f4fff9",
        10,
        "#b9ff66",
        22,
        "#47d7e8",
      ],
      "circle-stroke-color": "#07110f",
      "circle-stroke-width": 1.5,
    },
  });

  map.addLayer({
    id: "fibonacci-selected",
    type: "circle",
    source: "fibonacci-points",
    filter: ["==", ["get", "index"], -1],
    paint: {
      "circle-radius": 15,
      "circle-color": "#b9ff66",
      "circle-opacity": 0.12,
      "circle-stroke-color": "#f2fff8",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: "fibonacci-labels",
    type: "symbol",
    source: "fibonacci-points",
    minzoom: 3.2,
    layout: {
      "text-field": ["concat", "F", ["to-string", ["get", "index"]]],
      "text-size": 10,
      "text-offset": [0, 1.45],
      "text-anchor": "top",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#e8fff4",
      "text-halo-color": "#07110f",
      "text-halo-width": 1.5,
    },
  });

  render();
  elements.loading.classList.add("hidden");

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setTimeout(() => {
      if (state.selectedIndex === null && !state.isChoosingOrigin) playAnimation();
    }, 600);
  }
});

const popup = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 12,
});

map.on("mouseenter", "fibonacci-points", (event) => {
  if (state.isChoosingOrigin) return;

  map.getCanvas().style.cursor = "pointer";
  const feature = state.features[Number(event.features[0].properties.index) - 1];
  if (feature) showPointPopup(feature);
});

map.on("mouseleave", "fibonacci-points", () => {
  if (!state.isChoosingOrigin) map.getCanvas().style.cursor = "";
  const selected = state.features[state.selectedIndex - 1];
  if (selected && !state.isChoosingOrigin) showPointPopup(selected);
  else popup.remove();
});

map.on("click", "fibonacci-points", (event) => {
  if (!state.isChoosingOrigin && event.features.length) {
    focusTerm(Number(event.features[0].properties.index));
  }
});

map.on("click", (event) => {
  if (!state.isChoosingOrigin) return;

  const coordinates = [
    Number((((event.lngLat.lng + 180) % 360 + 360) % 360 - 180).toFixed(6)),
    Number(event.lngLat.lat.toFixed(6)),
  ];

  setOrigin(coordinates);
  map.easeTo({ center: coordinates, duration: 700 });
  showToast("New origin selected");
});

document.querySelectorAll("[data-angle]").forEach((button) => {
  button.addEventListener("click", () => {
    stopAnimation();
    state.angle = Number(button.dataset.angle);
    state.visibleCount = state.count;
    document
      .querySelectorAll("[data-angle]")
      .forEach((candidate) => candidate.classList.remove("active"));
    button.classList.add("active");
    render();
    updateUrl();
  });
});

elements.pointCount.addEventListener("input", (event) => {
  stopAnimation();
  state.count = Number(event.target.value);
  state.visibleCount = state.count;
  render();
  updateUrl();
});

elements.reach.addEventListener("input", (event) => {
  stopAnimation();
  state.reachKm = Number(event.target.value);
  state.visibleCount = state.count;
  render();
  updateUrl();
});

elements.play.addEventListener("click", togglePlayback);
elements.download.addEventListener("click", downloadGeoJson);
elements.toggleAnalysis.addEventListener("click", () => setAnalysisOpen(elements.analysisPanel.hidden));
elements.closeAnalysis.addEventListener("click", () => setAnalysisOpen(false));
elements.retryAnalysis.addEventListener("click", loadGeography);
document.querySelector("#showControls").addEventListener("click", () => {
  document.body.classList.remove("point-focused");
  setAnalysisOpen(false);
  popup.remove();
});
for (const container of [elements.analysisList, elements.sequence]) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (button) focusTerm(Number(button.dataset.index));
  });
}

elements.selectOrigin.addEventListener("click", () => {
  state.isChoosingOrigin = !state.isChoosingOrigin;
  document.body.classList.toggle("map-selecting", state.isChoosingOrigin);
  elements.selectOrigin.textContent = state.isChoosingOrigin
    ? "Click anywhere…"
    : "Choose on map";

  if (state.isChoosingOrigin) {
    popup.remove();
    showToast("Click anywhere on Earth to set the origin");
  }
});

elements.resetOrigin.addEventListener("click", () => {
  setOrigin(DEFAULT_ORIGIN, "Mitad del Mundo");
  map.easeTo({ center: DEFAULT_ORIGIN, zoom: 2.45, duration: 700 });
  showToast("Origin reset to Mitad del Mundo");
});

elements.cleanView.addEventListener("click", () => {
  document.body.classList.toggle("clean-mode");
});

elements.shareView.addEventListener("click", async () => {
  const url = updateUrl();
  try {
    await navigator.clipboard.writeText(url.toString());
    showToast("View link copied");
  } catch {
    window.prompt("Copy this link:", url.toString());
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "h")
    document.body.classList.toggle("clean-mode");
  if (event.code === "Space" && event.target === document.body) {
    event.preventDefault();
    togglePlayback();
  }
});

render();
setAnalysisOpen(!window.matchMedia("(max-width: 1100px)").matches);
loadGeography();
