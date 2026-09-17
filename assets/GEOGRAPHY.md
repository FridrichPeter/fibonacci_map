# Bundled geography

Public-domain data from [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), retrieved on 2026-09-16.

- `countries-50m.geojson`: 242 country/territory features from [Admin 0 countries, 1:50m](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson). Original geometry retained; properties reduced to `ADMIN` (name) and `ADM0_A3` (code).
- `places-50m.json`: 1,251 selected populated places from [Populated places simple, 1:50m](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson). Retains name, country name and original point coordinates.

Run `python scripts/prepare-geography.py` to refresh these assets from the upstream repository. This is an optional maintainer operation; normal use makes no geocoding API calls.

The analysis tests each term point against country polygons, then finds the closest city in this selected dataset using great-circle distance. The closest city can be in a different country. Country boundaries are generalized, follow Natural Earth's default boundary representation, and are not suitable for precise coastal or parcel analysis. An unmatched point is labeled "Open water / unmapped land" because small islands and other details may be absent. Connecting line segments are not analyzed.
