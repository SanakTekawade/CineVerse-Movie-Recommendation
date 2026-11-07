"""
Runner script for CineVerse Movie Recommendation System.
Launches the FastAPI server on http://127.0.0.1:8000.
"""

import sys
import uvicorn
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Ensure UTF-8 stdout encoding on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def main():
    print("=================================================================")
    print("[CineVerse] NLP Movie Recommendation System")
    print("Powered by TF-IDF Vectorization & Cosine Similarity")
    print("=================================================================")
    print("Server running at: http://127.0.0.1:8000")
    print("Interactive Swagger Docs: http://127.0.0.1:8000/docs")
    print("Press Ctrl+C to terminate.")
    print("=================================================================")

    uvicorn.run(
        "backend.app:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info"
    )

if __name__ == "__main__":
    main()
