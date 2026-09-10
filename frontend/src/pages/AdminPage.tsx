/*
This file shows the admin-only page: all users with email, status, karma editing, bans, and karma history.
Edit this file when admin user tools change. Other admin tools live on the wall, bet, and links pages.
Copy this file as a starting point when you add another admin-only page.
*/

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, postJson } from "../shared/api";
import { Avatar } from "../shared/Avatar";
import { formatDateTime, signed } from "../shared/format";
import type { AdminUser, KarmaChange } from "../shared/types";
import { Button, Card, ErrorText, InfoText, PageTitle } from "../shared/ui";

function StatusBadges({ person }: { person: AdminUser }) {
  const badges = [];
  if (person.is_admin) badges.push(["admin", "bg-yellow-300"]);
  if (person.is_banned) badges.push(["banned", "bg-rose-300"]);
  if (!person.email_confirmed && !person.is_admin) badges.push(["not confirmed", "bg-stone-200"]);
  if (badges.length === 0) badges.push(["ok", "bg-lime-200"]);
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map(([label, color]) => (
        <span className={`rounded-full border border-stone-900 px-2 text-xs font-bold ${color}`} key={label}>
          {label}
        </span>
      ))}
    </div>
  );
}

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [karmaDrafts, setRepDrafts] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<{ person: AdminUser; changes: KarmaChange[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await postJson<{ users: AdminUser[] }>("/admin/users/list");
      setUsers(data.users);
    } catch (loadError) {
      setError(errorMessage(loadError, "Could not load users."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setError("");
    setInfo("");
    try {
      await action();
      setInfo(success);
      await load();
    } catch (actionError) {
      setError(errorMessage(actionError));
    }
  };

  const saveKarma = (person: AdminUser) =>
    act(async () => {
      await postJson("/admin/users/set-karma", { user_id: person.id, karma: Number(karmaDrafts[person.id] ?? person.karma) });
      setRepDrafts((current) => {
        const next = { ...current };
        delete next[person.id];
        return next;
      });
    }, `Karma of ${person.username} was updated.`);

  const toggleBan = (person: AdminUser) =>
    act(
      () => postJson("/admin/users/ban", { user_id: person.id, banned: !person.is_banned }),
      `${person.username} was ${person.is_banned ? "unbanned" : "banned"}.`,
    );

  const showHistory = async (person: AdminUser) => {
    try {
      const data = await postJson<{ changes: KarmaChange[] }>("/admin/users/karma-history", { user_id: person.id });
      setHistory({ person, changes: data.changes });
    } catch (historyError) {
      setError(errorMessage(historyError));
    }
  };

  return (
    <section className="space-y-6">
      <PageTitle
        title="Admin page"
        subtitle="Users, karma, and bans. More admin tools are on the pages themselves: right-click any wall note, open any bet, or check the links list."
      />
      <ErrorText>{error}</ErrorText>
      <InfoText>{info}</InfoText>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-stone-900">
              <th className="py-2">Nickname</th>
              <th>Email</th>
              <th>Status</th>
              <th>Karma</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((person) => (
              <tr className="border-b border-stone-200" key={person.id}>
                <td className="py-2">
                  <Link className="flex items-center gap-2 font-bold hover:underline" to={`/u/${person.username}`}>
                    <Avatar size="sm" username={person.username} />
                    {person.username}
                  </Link>
                </td>
                <td className="break-all">{person.email ?? "—"}</td>
                <td>
                  <StatusBadges person={person} />
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <input
                      aria-label={`Karma for ${person.username}`}
                      className="w-24 rounded-lg border-2 border-stone-900 px-2 py-1"
                      onChange={(event) => setRepDrafts((current) => ({ ...current, [person.id]: event.target.value }))}
                      type="number"
                      value={karmaDrafts[person.id] ?? String(person.karma)}
                    />
                    <Button className="px-2 py-1 text-xs" onClick={() => void saveKarma(person)} variant="secondary">
                      Set
                    </Button>
                  </div>
                </td>
                <td className="whitespace-nowrap">
                  <div className="flex gap-1">
                    <Button className="px-2 py-1 text-xs" onClick={() => void showHistory(person)} variant="secondary">
                      History
                    </Button>
                    {!person.is_admin ? (
                      <Button className="px-2 py-1 text-xs" onClick={() => void toggleBan(person)} variant={person.is_banned ? "secondary" : "danger"}>
                        {person.is_banned ? "Unban" : "Ban"}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {history ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Karma history of {history.person.username}</h2>
            <Button onClick={() => setHistory(null)} variant="secondary">
              Close
            </Button>
          </div>
          {history.changes.length === 0 ? (
            <p className="mt-3 text-stone-600">No karma changes yet.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-stone-900">
                  <th className="py-1">When</th>
                  <th>Change</th>
                  <th>Karma after</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.changes.map((change) => (
                  <tr className="border-b border-stone-200" key={change.id}>
                    <td className="py-1">{formatDateTime(change.created_at)}</td>
                    <td className={`font-bold ${change.delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{signed(change.delta)}</td>
                    <td>{change.karma_after}</td>
                    <td>
                      {change.reason}
                      {change.ref_id !== null ? ` #${change.ref_id}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : null}
    </section>
  );
}
