/*
This file shows The Wall start page: a link to your own wall and a searchable list of everybody's walls.
Edit this file when the people list or wall directory search changes.
Copy this file as a starting point when you add another searchable list page.
*/

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/auth";
import { errorMessage, postJson } from "../shared/api";
import { Avatar } from "../shared/Avatar";
import type { PublicUser } from "../shared/types";
import { ErrorText, PageTitle } from "../shared/ui";

export function WallDirectoryPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      postJson<{ users: PublicUser[] }>("/users/list", { query })
        .then((data) => {
          setUsers(data.users);
          setError("");
        })
        .catch((loadError) => setError(errorMessage(loadError)))
        .finally(() => setLoaded(true));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <section>
      <PageTitle title="The Wall" subtitle="Everybody has a wall. Pick one and stick a note on it." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {user ? (
          <Link className="rounded-xl border-2 border-stone-900 bg-yellow-300 px-4 py-2 font-bold shadow-[3px_3px_0_#1c1917]" to={`/u/${user.username}`}>
            📌 Go to my wall
          </Link>
        ) : null}
        <input
          aria-label="Search people"
          className="min-w-60 flex-1 rounded-xl border-2 border-stone-900 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-yellow-300"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people..."
          type="search"
          value={query}
        />
      </div>
      <ErrorText>{error}</ErrorText>
      {loaded && !error && users.length === 0 ? <p className="text-stone-600">Nobody found.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((person) => (
          <li key={person.id}>
            <Link
              className="flex items-center gap-3 rounded-xl border-2 border-stone-900 bg-white p-3 shadow-[3px_3px_0_#1c1917] transition hover:-translate-y-0.5 hover:bg-yellow-50"
              to={`/u/${person.username}`}
            >
              <Avatar username={person.username} />
              <span className="font-bold">{person.username}</span>
              <span className="ml-auto text-sm text-stone-600">{person.karma} karma</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
