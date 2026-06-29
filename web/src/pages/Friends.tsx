import { NavBar } from "@/components/NavBar";

// Placeholder — the full friends/search/request flow lands in Phase 3,
// followed by the Blend in Phase 4.
export default function Friends() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Friends</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Connect with friends and blend your watch histories. Coming next.
        </p>
      </main>
    </div>
  );
}
