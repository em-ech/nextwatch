// Client for the Reverie FastAPI backend (app/api.py).
const API_BASE =
  (import.meta.env.VITE_API_BASE as string) ?? "http://localhost:8000";

export interface Movie {
  movieId: number;
  title: string;
  year: string;
  genres: string[];
  score?: number; // raw softmax probability (debug)
  match?: number; // Netflix-style 80-99% display match
  poster_url?: string | null;
  backdrop_url?: string | null;
}

export interface HistItem {
  movieId: number;
  rating: number; // stars, 0.5 - 5
}

export interface RecResponse {
  recommendations: Movie[];
  taste: Record<string, number> | null;
}

export interface ImportItem extends Movie {
  rating: number;
}

export interface ImportResponse {
  source: "letterboxd" | "netflix";
  total: number;
  matched: number;
  history: ImportItem[];
}

export async function searchCatalog(
  q: string,
  limit = 12,
  genre = "",
): Promise<Movie[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (genre) params.set("genre", genre);
  const r = await fetch(`${API_BASE}/catalog?${params.toString()}`);
  if (!r.ok) throw new Error("catalog search failed");
  return r.json();
}

export async function getRecommendations(
  history: HistItem[],
  n = 12,
): Promise<RecResponse> {
  const r = await fetch(`${API_BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, n }),
  });
  if (!r.ok) throw new Error("recommend failed");
  return r.json();
}

// Upload a Letterboxd ratings.csv or Netflix ViewingActivity.csv and turn it
// into a watch history. Do NOT set Content-Type — the browser must set the
// multipart boundary itself.
export async function importWatchlist(
  file: File,
  ratingsFile?: File | null,
  source = "auto",
): Promise<ImportResponse> {
  const form = new FormData();
  form.append("file", file);
  if (ratingsFile) form.append("ratings_file", ratingsFile);
  form.append("source", source);
  const r = await fetch(`${API_BASE}/import`, { method: "POST", body: form });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new Error(detail?.detail ?? "import failed");
  }
  return r.json();
}
