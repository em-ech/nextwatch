import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

// Gate a route behind a logged-in session; redirect to /login otherwise.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
