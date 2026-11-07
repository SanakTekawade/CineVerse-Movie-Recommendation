"""
FastAPI Server for CineVerse Movie Recommendation System.
Provides RESTful APIs for catalog exploration, movie search, genre filtering,
and NLP content-based recommendations using TF-IDF & Cosine Similarity.
Serves frontend static assets directly for seamless single-server deployment.
"""

from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.engine import MovieRecommenderEngine

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(
    title="CineVerse NLP Movie Recommender API",
    description="Intelligent Content-Based Movie Recommendation System powered by TF-IDF & Cosine Similarity",
    version="1.0.0"
)

# Enable CORS for development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize NLP Recommender Engine at startup
engine = MovieRecommenderEngine()

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "CineVerse NLP Recommender"}

@app.get("/api/movies")
def list_movies(
    genre: Optional[str] = None,
    sort_by: Optional[str] = Query("popular", pattern="^(popular|rating|year|title)$"),
    limit: Optional[int] = 100
):
    """
    Returns list of movies, optionally filtered by genre and sorted.
    """
    movies = engine.get_all_movies()
    if genre and genre.lower() != "all":
        g_clean = genre.strip().lower()
        movies = [m for m in movies if any(g.lower() == g_clean for g in m.get("genres", []))]

    if sort_by == "rating":
        movies = sorted(movies, key=lambda x: x.get("vote_average", 0), reverse=True)
    elif sort_by == "year":
        movies = sorted(movies, key=lambda x: x.get("release_year", 0), reverse=True)
    elif sort_by == "title":
        movies = sorted(movies, key=lambda x: x.get("title", ""))
    else:  # popular
        movies = sorted(movies, key=lambda x: (x.get("vote_count", 0), x.get("vote_average", 0)), reverse=True)

    return {"count": len(movies), "movies": movies[:limit]}

@app.get("/api/movies/featured")
def get_featured_movie():
    """Returns the flagship hero featured movie (e.g. Interstellar)."""
    # Interstellar (ID: 157336) or top rated
    featured = engine.get_movie_by_id(157336)
    if not featured:
        all_m = engine.get_all_movies()
        featured = all_m[0] if all_m else {}
    return featured

@app.get("/api/movies/{movie_id}")
def get_movie_detail(movie_id: int):
    """Returns full metadata for a specific movie."""
    movie = engine.get_movie_by_id(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie

@app.get("/api/recommend/{movie_id}")
def get_recommendations(movie_id: int, top_n: int = Query(8, ge=1, le=24)):
    """
    Computes top-N most similar movies using TF-IDF and Cosine Similarity.
    """
    source_movie = engine.get_movie_by_id(movie_id)
    if not source_movie:
        raise HTTPException(status_code=404, detail=f"Movie with ID {movie_id} not found in catalog")

    recommendations = engine.recommend_similar_movies(movie_id=movie_id, top_n=top_n)
    return {
        "source_movie": {
            "id": source_movie["id"],
            "title": source_movie["title"],
            "genres": source_movie.get("genres", []),
            "release_year": source_movie.get("release_year")
        },
        "recommendation_count": len(recommendations),
        "algorithm": "TF-IDF (1-2 N-grams) + Cosine Similarity",
        "recommendations": recommendations
    }

@app.get("/api/recommend-by-text")
def recommend_by_text(q: str = Query(..., min_length=2), top_n: int = Query(8, ge=1, le=24)):
    """
    Allows user to type any free-form query or plot keywords and computes
    cosine similarity against all movie content vectors in TF-IDF space.
    """
    results = engine.recommend_by_natural_language(query=q, top_n=top_n)
    return {
        "query": q,
        "count": len(results),
        "recommendations": results
    }

@app.get("/api/search")
def search_movies(q: str = Query("", min_length=0), limit: int = 20):
    """
    Real-time autocomplete & title search.
    """
    results = engine.search_movies(query=q, limit=limit)
    return {"query": q, "count": len(results), "movies": results}

@app.get("/api/genres")
def get_genres():
    """Returns list of unique genres present in dataset with counts."""
    all_movies = engine.get_all_movies()
    counts = {}
    for m in all_movies:
        for g in m.get("genres", []):
            counts[g] = counts.get(g, 0) + 1
    
    # Sort by frequency descending
    sorted_genres = [{"name": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)]
    return {"genres": sorted_genres}

@app.get("/api/stats")
def get_stats():
    """Returns statistics about the NLP dataset, vocabulary, and model."""
    return engine.get_stats()

# Mount static files
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "Frontend index.html not found"}

    # Catch-all for assets (e.g. /css/style.css, /js/app.js)
    @app.get("/{full_path:path}")
    async def catch_all_static(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        raise HTTPException(status_code=404, detail="File not found")
