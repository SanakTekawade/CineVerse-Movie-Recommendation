import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor

with open("data/movies.json", "r", encoding="utf-8") as f:
    movies = json.load(f)

def check_movie(m):
    poster = m.get("poster_path", "")
    if not poster:
        return m["title"], "No poster path", m.get("id")
    url = f"https://image.tmdb.org/t/p/w500{poster}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                return m["title"], "OK", m.get("id")
            return m["title"], f"Status {resp.status}", m.get("id")
    except Exception as e:
        return m["title"], str(e), m.get("id")

print(f"Checking {len(movies)} movies in parallel...")
with ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(check_movie, movies))

broken = [r for r in results if r[1] != "OK"]
print(f"\nTotal broken images: {len(broken)} / {len(movies)}")
for b in broken:
    print(f"- {b[0]} (ID: {b[2]}): {b[1]}")
