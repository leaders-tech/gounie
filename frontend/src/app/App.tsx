/*
This file builds the main gounie layout, top navigation, routes, and route guards.
Edit this file when top-level pages, navigation, or auth guard behavior changes.
Copy the route pattern here when you add another top-level page.
*/

import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Avatar } from "../shared/Avatar";
import { AccountPage } from "../pages/AccountPage";
import { AdminPage } from "../pages/AdminPage";
import { BetDetailPage } from "../pages/BetDetailPage";
import { BetsPage } from "../pages/BetsPage";
import { ConfirmEmailPage } from "../pages/ConfirmEmailPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { FridayPage } from "../pages/FridayPage";
import { HomePage } from "../pages/HomePage";
import { LinksPage } from "../pages/LinksPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { SlotsPage } from "../pages/SlotsPage";
import { UserWallPage } from "../pages/UserWallPage";
import { WallDirectoryPage } from "../pages/WallDirectoryPage";

const NAV_LINKS = [
  { to: "/friday", label: "Friday?" },
  { to: "/wall", label: "The Wall" },
  { to: "/eps-bet", label: "EPS-bet" },
  { to: "/urls", label: "URLs" },
  { to: "/slots", label: "Slots" },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-full px-3 py-1.5 transition ${isActive ? "bg-stone-900 text-amber-50" : "hover:bg-stone-900/10"}`;
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-stone-900 bg-amber-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            className="-rotate-2 rounded-lg border-2 border-stone-900 bg-yellow-300 px-3 py-0.5 text-2xl font-black tracking-tight shadow-[3px_3px_0_#1c1917]"
            to="/"
          >
            gounie
          </Link>
          {user ? (
            <>
              <nav aria-label="Main" className="flex flex-wrap items-center gap-1 text-sm font-semibold">
                {NAV_LINKS.map((link) => (
                  <NavLink className={navClass} key={link.to} to={link.to}>
                    {link.label}
                  </NavLink>
                ))}
                {user.is_admin && (
                  <NavLink className={navClass} to="/admin">
                    Admin
                  </NavLink>
                )}
              </nav>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link className="flex items-center gap-2 font-semibold hover:underline" to={`/u/${user.username}`}>
                  <Avatar size="sm" username={user.username} />
                  {user.username}
                </Link>
                <span
                  className={`rounded-full border-2 border-stone-900 px-2 py-0.5 font-bold ${user.karma < 0 ? "bg-rose-200" : "bg-lime-200"}`}
                  data-testid="header-karma"
                >
                  {user.karma} karma
                </span>
                <NavLink className={navClass} to="/account">
                  Account
                </NavLink>
                <button className="rounded-full bg-stone-900 px-3 py-1.5 font-semibold text-amber-50" onClick={() => void logout()} type="button">
                  Logout
                </button>
              </div>
            </>
          ) : (
            <nav className="flex gap-1 text-sm font-semibold">
              <NavLink className={navClass} to="/login">
                Login
              </NavLink>
              <NavLink className={navClass} to="/register">
                Register
              </NavLink>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <p className="text-stone-600">Loading session...</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <p className="text-stone-600">Loading session...</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.is_admin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function protectedPage(page: React.ReactNode) {
  return <RequireAuth>{page}</RequireAuth>;
}

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/confirm" element={<ConfirmEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset" element={<ResetPasswordPage />} />
        <Route path="/" element={protectedPage(<HomePage />)} />
        <Route path="/account" element={protectedPage(<AccountPage />)} />
        <Route path="/friday" element={protectedPage(<FridayPage />)} />
        <Route path="/wall" element={protectedPage(<WallDirectoryPage />)} />
        <Route path="/u/:username" element={protectedPage(<UserWallPage />)} />
        <Route path="/eps-bet" element={protectedPage(<BetsPage />)} />
        <Route path="/eps-bet/:betId" element={protectedPage(<BetDetailPage />)} />
        <Route path="/urls" element={protectedPage(<LinksPage />)} />
        <Route path="/slots" element={protectedPage(<SlotsPage />)} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export { RequireAdmin, RequireAuth };
