"""
Natural Language Processing (NLP) Movie Recommendation Engine.
Uses TF-IDF Vectorization and Cosine Similarity over metadata soups (plot overview,
genres, thematic keywords, director, and top cast).
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class MovieRecommenderEngine:
    def __init__(self, data_path: Optional[str] = None):
        if data_path is None:
            data_path = str(Path(__file__).resolve().parent.parent / "data" / "movies.json")
        self.data_path = Path(data_path)
        self.movies_df: pd.DataFrame = pd.DataFrame()
        self.tfidf_matrix = None
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.cosine_sim_matrix: Optional[np.ndarray] = None
        self.indices: Dict[int, int] = {}  # tmdb_id -> dataframe index
        self.title_indices: Dict[str, int] = {}  # lowercase title -> dataframe index
        self._load_and_fit()

    def _clean_text(self, text: str) -> str:
        """Basic text normalization: lowercase, remove non-alphanumeric punctuation."""
        if not text or not isinstance(text, str):
            return ""
        text = text.lower()
        text = re.sub(r"[^\w\s-]", " ", text)
        return " ".join(text.split())

    def _create_content_soup(self, row: pd.Series) -> str:
        """
        Synthesizes a weighted metadata soup for TF-IDF feature extraction.
        Genres and director are given higher emphasis to capture thematic and directorial affinity.
        """
        overview = self._clean_text(str(row.get("overview", "")))
        
        # Genres (boosted with weight x2)
        genres = row.get("genres", [])
        if isinstance(genres, list):
            genre_tokens = " ".join([self._clean_text(g).replace(" ", "_") for g in genres])
            genre_boosted = f"{genre_tokens} {genre_tokens}"
        else:
            genre_boosted = ""

        # Thematic Keywords
        keywords = row.get("keywords", [])
        if isinstance(keywords, list):
            kw_tokens = " ".join([self._clean_text(k) for k in keywords])
        else:
            kw_tokens = ""

        # Director (boosted x2)
        director = self._clean_text(str(row.get("director", ""))).replace(" ", "_")
        director_boosted = f"{director} {director}" if director else ""

        # Top Cast (first 3 cast members)
        cast = row.get("cast", [])
        if isinstance(cast, list):
            cast_tokens = " ".join([self._clean_text(c).replace(" ", "_") for c in cast[:3]])
        else:
            cast_tokens = ""

        # Combine into cohesive document
        soup = f"{overview} {genre_boosted} {kw_tokens} {director_boosted} {cast_tokens}"
        return soup

    def _load_and_fit(self):
        """Loads dataset and constructs the TF-IDF feature space and similarity matrix."""
        if not self.data_path.exists():
            raise FileNotFoundError(f"Movie dataset not found at {self.data_path}")

        with open(self.data_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.movies_df = pd.DataFrame(data)
        
        # Handle missing values
        self.movies_df["overview"] = self.movies_df["overview"].fillna("")
        self.movies_df["genres"] = self.movies_df["genres"].apply(lambda x: x if isinstance(x, list) else [])
        self.movies_df["keywords"] = self.movies_df["keywords"].apply(lambda x: x if isinstance(x, list) else [])
        self.movies_df["cast"] = self.movies_df["cast"].apply(lambda x: x if isinstance(x, list) else [])
        self.movies_df["director"] = self.movies_df["director"].fillna("Unknown")
        self.movies_df["vote_average"] = self.movies_df["vote_average"].fillna(7.0)
        self.movies_df["release_year"] = self.movies_df["release_year"].fillna(2000).astype(int)

        # Generate metadata soups
        self.movies_df["soup"] = self.movies_df.apply(self._create_content_soup, axis=1)

        # Initialize TF-IDF Vectorizer with unigrams and bigrams
        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
            max_features=10000,
            sublinear_tf=True
        )

        # Transform corpus into TF-IDF document-term matrix
        self.tfidf_matrix = self.vectorizer.fit_transform(self.movies_df["soup"])

        # Compute full Pairwise Cosine Similarity matrix
        self.cosine_sim_matrix = cosine_similarity(self.tfidf_matrix, self.tfidf_matrix)

        # Build fast lookup indexes
        self.indices = {row["id"]: idx for idx, row in self.movies_df.iterrows()}
        self.title_indices = {row["title"].strip().lower(): idx for idx, row in self.movies_df.iterrows()}

        print(f"[NLP Engine] Fitted TF-IDF Vectorizer on {len(self.movies_df)} movies.")
        print(f"[NLP Engine] Vocabulary Size: {len(self.vectorizer.vocabulary_)} terms/ngrams.")

    def get_all_movies(self) -> List[Dict[str, Any]]:
        """Returns list of all movies in the catalog."""
        records = self.movies_df.to_dict(orient="records")
        for r in records:
            r.pop("soup", None)
        return records

    def get_movie_by_id(self, movie_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves a single movie by its TMDB ID."""
        if movie_id not in self.indices:
            return None
        idx = self.indices[movie_id]
        item = self.movies_df.iloc[idx].to_dict()
        item.pop("soup", None)
        return item

    def search_movies(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Title substring and token search.
        """
        if not query or not query.strip():
            return self.get_all_movies()[:limit]

        q = query.strip().lower()
        results = []
        for _, row in self.movies_df.iterrows():
            title_lower = row["title"].lower()
            if q in title_lower:
                results.append(row.to_dict())
            elif any(q in g.lower() for g in row.get("genres", [])):
                results.append(row.to_dict())
            elif q in row.get("director", "").lower():
                results.append(row.to_dict())

        # Clean output
        for r in results:
            r.pop("soup", None)
        return results[:limit]

    def recommend_similar_movies(self, movie_id: int, top_n: int = 8) -> List[Dict[str, Any]]:
        """
        Computes Top-N similar movies using Cosine Similarity on TF-IDF feature vectors.
        Includes computed similarity percentage and explainable overlapping features.
        """
        if movie_id not in self.indices:
            return []

        idx = self.indices[movie_id]
        target_movie = self.movies_df.iloc[idx]
        sim_scores = list(enumerate(self.cosine_sim_matrix[idx]))

        # Sort movies based on similarity score (descending)
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)

        # Exclude target movie itself (index idx, score 1.0)
        sim_scores = [s for s in sim_scores if s[0] != idx][:top_n]

        recommendations = []
        target_genres = set(target_movie.get("genres", []))
        target_keywords = set(target_movie.get("keywords", []))

        max_score = sim_scores[0][1] if sim_scores else 1.0
        if max_score <= 0:
            max_score = 1.0

        for sim_idx, score in sim_scores:
            rec_row = self.movies_df.iloc[sim_idx].to_dict()
            rec_row.pop("soup", None)

            # Calibrate display match percentage for intuitive UX (e.g. 72% - 98%)
            # while exposing the exact raw cosine similarity
            relative_ratio = float(score) / max_score
            display_pct = round(68.0 + (relative_ratio * 30.0), 1)

            # Extract explainable overlap
            overlap_genres = list(target_genres.intersection(set(rec_row.get("genres", []))))
            overlap_keywords = list(target_keywords.intersection(set(rec_row.get("keywords", []))))
            same_director = (target_movie.get("director") == rec_row.get("director"))

            rec_row["nlp_similarity_score"] = round(float(score), 4)
            rec_row["match_percentage"] = display_pct
            rec_row["match_explanation"] = {
                "shared_genres": overlap_genres,
                "shared_keywords": overlap_keywords,
                "shared_director": rec_row.get("director") if same_director else None
            }
            recommendations.append(rec_row)

        return recommendations

    def recommend_by_natural_language(self, query: str, top_n: int = 8) -> List[Dict[str, Any]]:
        """
        Allows users to input natural language (e.g. 'mind bending dream heist sci-fi'
        or 'space exploration emotional father daughter') to get ranked recommendations.
        """
        if not query or not query.strip():
            return []

        cleaned_query = self._clean_text(query)
        query_vector = self.vectorizer.transform([cleaned_query])
        sim_scores = cosine_similarity(query_vector, self.tfidf_matrix).flatten()

        top_indices = sim_scores.argsort()[::-1][:top_n]

        recommendations = []
        for idx in top_indices:
            score = sim_scores[idx]
            if score <= 0.005:
                continue
            rec_row = self.movies_df.iloc[idx].to_dict()
            rec_row.pop("soup", None)
            rec_row["nlp_similarity_score"] = round(float(score), 4)
            rec_row["match_percentage"] = round(float(score) * 100, 1)
            recommendations.append(rec_row)

        return recommendations

    def get_stats(self) -> Dict[str, Any]:
        """Provides statistical breakdown of catalog and NLP model for academic review."""
        all_genres = []
        for g_list in self.movies_df["genres"]:
            all_genres.extend(g_list)
        genre_series = pd.Series(all_genres).value_counts()

        return {
            "total_movies": len(self.movies_df),
            "vocabulary_size": len(self.vectorizer.vocabulary_),
            "algorithm": "TF-IDF (Term Frequency-Inverse Document Frequency) + Cosine Similarity",
            "ngram_range": "(1, 2) Unigrams and Bigrams",
            "similarity_metric": "Pairwise Cosine Distance in Euclidean Space",
            "top_genres": genre_series.head(10).to_dict(),
            "average_rating": round(float(self.movies_df["vote_average"].mean()), 2),
            "earliest_year": int(self.movies_df["release_year"].min()),
            "latest_year": int(self.movies_df["release_year"].max())
        }

if __name__ == "__main__":
    recommender = MovieRecommenderEngine()
    print("\n--- Testing Recommendations for 'Interstellar' (ID: 157336) ---")
    recs = recommender.recommend_similar_movies(157336, top_n=5)
    for r in recs:
        print(f"[{r['match_percentage']}%] {r['title']} ({r['release_year']}) - Genres: {', '.join(r['genres'])}")

    print("\n--- Testing Free-Form NLP Query: 'dystopian cyberpunk replicant detective' ---")
    query_recs = recommender.recommend_by_natural_language("dystopian cyberpunk replicant detective", top_n=3)
    for r in query_recs:
        print(f"[{r['match_percentage']}%] {r['title']} ({r['release_year']}) - Overview: {r['overview'][:80]}...")
