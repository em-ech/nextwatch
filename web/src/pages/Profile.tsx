import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Film, Users } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import {
  HistoryEntry,
  Me,
  getMe,
  getSavedHistory,
  removeSavedMovie,
} from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import { NavBar } from "@/components/NavBar";
import { PosterCard } from "@/components/PosterCard";
import { Button } from "@/components/ui/button";

export default function Profile() {
  const { user } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMe(), getSavedHistory()])
      .then(([m, h]) => {
        setMe(m);
        setHistory(h);
      })
      .finally(() => setLoading(false));
  }, []);

  const remove = async (movieId: number) => {
    setHistory(await removeSavedMovie(movieId));
    setMe((m) => (m ? { ...m, history_count: m.history_count - 1 } : m));
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        {/* Profile header */}
        <header className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {(user?.display_name ?? user?.username ?? "?")[0].toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {user?.display_name ?? user?.username}
            </h1>
            <p className="text-sm text-muted-foreground">@{user?.username}</p>
            <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Film className="h-4 w-4" /> {me?.history_count ?? 0} seen
              </span>
              <Link
                to="/friends"
                className="flex items-center gap-1 hover:text-primary"
              >
                <Users className="h-4 w-4" /> {me?.friend_count ?? 0} friends
              </Link>
            </div>
          </div>
        </header>

        {/* Movies I've seen */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">
              Movies I've seen
            </h2>
            <Link to="/">
              <Button variant="ghost" size="sm">
                Add more
              </Button>
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading your history...
            </p>
          ) : history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">
                You haven't added any movies yet.
              </p>
              <Link to="/">
                <Button className="mt-3 shadow-red-glow">
                  Build your history
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              <AnimatePresence>
                {history.map((m) => (
                  <PosterCard
                    key={m.movieId}
                    movie={m}
                    onRemove={(mv) => remove(mv.movieId)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
