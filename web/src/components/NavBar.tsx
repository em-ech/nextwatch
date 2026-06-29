import { Link, useNavigate } from "react-router-dom";
import { User as UserIcon, LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

// Top navigation: brand + (when logged in) Profile/Friends + logout.
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
