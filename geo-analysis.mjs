const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees) => (degrees * Math.PI) / 180;

export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
    Math.sin(radians(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

// Ray casting with explicit boundary inclusion. Natural Earth splits polygons
// at the antimeridian, so each ring can be tested in longitude/latitude space.
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-10 &&
        x >= Math.min(xi, xj) && x <= Math.max(xi, xj) &&
        y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return true;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function inPolygon(point, rings) {
  return inRing(point, rings[0]) && !rings.slice(1).some((hole) => inRing(point, hole));
}

export function createAnalyzer(countries, places) {
  if (!countries.features?.length || !places.length) throw new Error("Empty geography data");
  const polygons = countries.features.flatMap((feature) => {
    const geometry = feature.geometry;
    const parts = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return parts.map((rings) => {
      const bounds = rings[0].reduce(([west, south, east, north], [lon, lat]) => [
        Math.min(west, lon), Math.min(south, lat), Math.max(east, lon), Math.max(north, lat),
      ], [Infinity, Infinity, -Infinity, -Infinity]);
      return { rings, bounds, country: feature.properties };
    });
  });

  return (coordinates) => {
    const [lon, lat] = coordinates;
    const candidates = Math.abs(lon) === 180 ? [[lon, lat], [-lon, lat]] : [coordinates];
    const match = polygons.find(({ bounds: [west, south, east, north], rings }) =>
      candidates.some((point) => point[0] >= west && point[0] <= east &&
        lat >= south && lat <= north && inPolygon(point, rings)));
    let nearest = null;
    let nearestDistance = Infinity;
    for (const place of places) {
      const distance = distanceKm(coordinates, place.coordinates);
      if (distance < nearestDistance) {
        nearest = place;
        nearestDistance = distance;
      }
    }
    return {
      country: match?.country.name ?? null,
      countryCode: match?.country.code ?? null,
      nearestPlace: nearest.name,
      nearestPlaceCountry: nearest.country,
      nearestPlaceDistanceKm: Number(nearestDistance.toFixed(1)),
    };
  };
}
