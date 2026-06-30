import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  Movie,
  HistItem,
  getRecommendations,
  getSavedHistory,
  addSavedMovie,
} from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import { NavBar } from "@/components/NavBar";
import { PosterCard } from "@/components/PosterCard";
import { CategoryRow } from "@/components/CategoryRow";
import { TasteRadar } from "@/components/TasteRadar";
import { Button } from "@/components/ui/button";
import { genreLabel } from "@/lib/utils";
import { HistEntry } from "./BuildHistory";

interface GenreRow {
  genre: string;
  movies: Movie[];
}
interface BecauseRow {
  title: string;
  movies: Movie[];
}

const FETCH_N = 40;

export default function Results() {
  const location = useLocation();
  const { user } = useAuth();
  const [history, setHistory] = useState<HistEntry[]>(
    (location.state as { history?: HistEntry[] })?.history ?? [],
  );
  const [recs, setRecs] = useState<Movie[]>([]);
  const [genreRows, setGenreRows] = useState<GenreRow[]>([]);
  const [because, setBecause] = useState<BecauseRow | null>(null);
  const [taste, setTaste] = useState<Record<string, number> | null>(null);
  const [blurb, setBlurb] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (hist: HistEntry[]) => {
    setLoading(true);
    try {
      const payload: HistItem[] = hist.map((h) => ({
        movieId: h.movie.movieId,
        rating: h.rating,
      }));
      const res = await getRecommendations(payload, FETCH_N);
      const all = res.recommendations;
      setRecs(all.slice(0, 14));
      setTaste(res.taste);
      setBlurb(res.blurb ?? null);

      const topGenres = res.taste
        ? Object.entries(res.taste)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([g]) => g)
        : [];
      setGenreRows(
        topGenres
          .map((g) => ({
            genre: g,
            movies: all.filter((m) => m.genres.includes(g)).slice(0, 12),
          }))
          .filter((r) => r.movies.length >= 4),
      );

      const last = hist[hist.length - 1];
      if (last) {
        const b = await getRecommendations(
          [{ movieId: last.movie.movieId, rating: 5 }],
          12,
        );
        setBecause({ title: last.movie.title, movies: b.recommendations });
      } else {
        setBecause(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolve the history (passed from Build, or the saved profile) then recommend.
  useEffect(() => {
    const passed = (location.state as { history?: HistEntry[] })?.history;
    if (passed && passed.length) {
      setHistory(passed);
      refresh(passed);
    } else if (user) {
      getSavedHistory().then((saved) => {
        const h = saved.map((m) => ({ movie: m, rating: m.rating }));
        setHistory(h);
        refresh(h);
      });
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const inHistory = (id: number) => history.some((h) => h.movie.movieId === id);

  // Thumbs-down: append as a low rating and re-rank live.
  const reject = async (movie: Movie) => {
    const next = inHistory(movie.movieId)
      ? history
      : [...history, { movie, rating: 1 }];
    setHistory(next);
    if (user && !inHistory(movie.movieId)) {
      addSavedMovie(movie.movieId, 1).catch(() => {});
    }
    await refresh(next);
  };

  const addMovie = (movie: Movie) => {
    if (inHistory(movie.movieId)) return;
    setHistory((h) => [...h, { movie, rating: 4 }]);
    if (user) addSavedMovie(movie.movieId, 4).catch(() => {});
  };

  const displayName = user?.display_name ?? user?.username;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        {/* Top: profile (left) + taste radar (right) */}
        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(300px,420px)]">
          <div className="flex flex-col justify-center gap-3">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  {(displayName ?? "?")[0].toUpperCase()}
                </span>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {displayName}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    @{user.username}
                  </p>
                  <Link
                    to="/profile"
                    className="text-sm text-primary hover:underline"
                  >
                    View profile
                  </Link>
                </div>
              </div>
            ) : (
              <h1 className="text-3xl font-extrabold text-foreground">
                Your picks
              </h1>
            )}
            {blurb ? (
              <p className="max-w-md text-lg leading-relaxed text-foreground">
                {blurb}
              </p>
            ) : (
              <p className="max-w-md text-muted-foreground">
                Recommendations from your watch history, with the genres you
                lean toward on the right.
              </p>
            )}
          </div>

          {taste && <TasteRadar taste={taste} />}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Thinking...
          </div>
        ) : recs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              No recommendations yet. Build a watch history first.
            </p>
            <Link to="/">
              <Button className="mt-3 shadow-red-glow">
                Build your history
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            <CategoryRow
              title="Top picks for you"
              subtitle="Reject one and watch the model rerank in real time."
            >
              {recs.map((m) => (
                <PosterCard
                  key={m.movieId}
                  movie={m}
                  showMatch
                  onReject={reject}
                />
              ))}
            </CategoryRow>

            {because && because.movies.length > 0 && (
              <CategoryRow title={`Because you watched ${because.title}`}>
                {because.movies.map((m) => (
                  <PosterCard
                    key={m.movieId}
                    movie={m}
                    showMatch
                    onAdd={addMovie}
                  />
                ))}
              </CategoryRow>
            )}

            {genreRows.map((row) => (
              <CategoryRow
                key={row.genre}
                title={`More ${genreLabel(row.genre)} for you`}
              >
                {row.movies.map((m) => (
                  <PosterCard
                    key={m.movieId}
                    movie={m}
                    showMatch
                    onAdd={addMovie}
                  />
                ))}
              </CategoryRow>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
