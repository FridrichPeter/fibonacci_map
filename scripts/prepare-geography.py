import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"

for name in ["ne_50m_admin_0_countries", "ne_10m_populated_places_simple"]:
    with urlopen(BASE + name + ".geojson", timeout=60) as response:
        data = json.load(response)
    if "countries" in name:
        for feature in data["features"]:
            props = feature["properties"]
            feature["properties"] = {"name": props["ADMIN"], "code": props["ADM0_A3"]}
        output = {"type": "FeatureCollection", "features": data["features"]}
        filename = "countries-50m.geojson"
    else:
        output = [
            {"name": f["properties"]["name"], "country": f["properties"]["adm0name"],
             "coordinates": f["geometry"]["coordinates"]}
            for f in data["features"]
        ]
        filename = "places-10m.json"
    path = ROOT / "assets" / filename
    path.write_text(json.dumps(output, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"{filename}: {len(data['features'])} features, {path.stat().st_size:,} bytes")
