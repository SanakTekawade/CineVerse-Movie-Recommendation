import wikipedia
try:
    page = wikipedia.page("The Martian (film)")
    print("Images:", [img for img in page.images if 'poster' in img.lower() or 'martian' in img.lower()][:3])
except Exception as e:
    print("Error:", e)
