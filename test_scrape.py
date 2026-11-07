import urllib.request
import re

url = 'https://www.themoviedb.org/movie/286217-the-martian'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        html = resp.read().decode('utf-8')
        matches = re.findall(r'/t/p/w[0-9]+(/[a-zA-Z0-9_\-]+\.jpg)', html)
        print("Matches found for The Martian:", set(matches))
except Exception as e:
    print("Error:", e)
