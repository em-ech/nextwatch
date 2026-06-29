import { Link, useNavigate } from "react-router-dom";
import { User as UserIcon, LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useRegion, Region } from "@/lib/RegionContext";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Toggles the streaming-availability region (drives ProviderBadges).
function RegionToggle() {
  const { region, setRegion } = useRegion();
  return (
    <div className="flex items-center overflow-hidden rounded-md border border-border text-xs">
      {(["US", "ES"] as Region[]).map((r) => (
        <button
          key={r}
          onClick={() => setRegion(r)}
          className={cn(
            "px-2 py-1 transition-colors",
            region === r
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// Top navigation: brand + region toggle + (when logged in) Profile/Friends + logout.
export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/">
          <BrandLogo />
        </Link>
        <nav className="flex items-center gap-2">
          <RegionToggle />
          {user ? (
            <>
              <Link to="/friends">
                <Button variant="ghost" size="sm">
                  Friends
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="sm">
                  <UserIcon className="mr-1.5 h-4 w-4" />
                  {user.username}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="shadow-red-glow">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
