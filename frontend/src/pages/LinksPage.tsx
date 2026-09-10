/*
This file shows the great url collection: add links, search them, vote on them, and edit or delete your own.
Edit this file when the link list, link form, search, or voting UI changes.
Copy this file as a starting point when you add another searchable collection page.
*/

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/auth";
import { errorMessage, postJson } from "../shared/api";
import { formatDate, linkHost } from "../shared/format";
import { useLiveEvent } from "../shared/live";
import type { LinkItem } from "../shared/types";
import { Button, Card, ErrorText, PageTitle, TextArea, TextField } from "../shared/ui";

type LinkFields = { url: string; title: string; description: string };

type LinkFormProps = {
  heading?: string;
  initial?: LinkFields;
  submitLabel: string;
  resetOnSuccess?: boolean;
  onSubmit: (fields: LinkFields) => Promise<void>;
  onCancel?: () => void;
};

function LinkForm({ heading, initial, submitLabel, resetOnSuccess = false, onSubmit, onCancel }: LinkFormProps) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit({ url, title, description });
      if (resetOnSuccess) {
        setUrl("");
        setTitle("");
        setDescription("");
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      {heading ? <h2 className="text-xl font-black">{heading}</h2> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="URL" maxLength={2000} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." required type="url" value={url} />
        <TextField label="Title" maxLength={200} onChange={(event) => setTitle(event.target.value)} required value={title} />
      </div>
      <TextArea label="Description" maxLength={1000} onChange={(event) => setDescription(event.target.value)} rows={2} value={description} />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button disabled={busy} type="submit">
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function LinksPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const load = useCallback(async (search: string) => {
    try {
      const data = await postJson<{ links: LinkItem[] }>("/links/list", { query: search });
      setLinks(data.links);
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 200);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  useLiveEvent((message) => {
    if (message.type === "links.changed") {
      void load(query);
    }
  });

  if (!user) {
    return null;
  }

  const vote = async (link: LinkItem, value: 1 | -1) => {
    const next = link.my_vote === value ? 0 : value;
    try {
      const data = await postJson<{ link: LinkItem }>("/links/vote", { link_id: link.id, value: next });
      setLinks((current) => current.map((item) => (item.id === link.id ? data.link : item)));
    } catch (voteError) {
      setError(errorMessage(voteError));
    }
  };

  const remove = async (link: LinkItem) => {
    try {
      const path = link.author_id === user.id ? "/links/delete" : "/admin/links/delete";
      await postJson(path, { id: link.id });
      setConfirmDeleteId(null);
      await load(query);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  };

  return (
    <section className="space-y-6">
      <PageTitle title="the great url collection" subtitle="Useful links from everyone. Upvote a link: its author gets +1 karma. Downvote it: -1 karma." />
      <Card>
        <LinkForm
          heading="Add a link"
          onSubmit={async (fields) => {
            await postJson("/links/create", fields);
            await load(query);
          }}
          resetOnSuccess
          submitLabel="Add link"
        />
      </Card>
      <input
        aria-label="Search links"
        className="w-full rounded-xl border-2 border-stone-900 bg-white px-4 py-3 text-lg outline-none focus:ring-4 focus:ring-yellow-300"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search titles, descriptions, urls, or authors..."
        type="search"
        value={query}
      />
      <ErrorText>{error}</ErrorText>
      {loaded && links.length === 0 ? <p className="text-stone-600">{query ? "No links match your search." : "No links yet. Add the first one!"}</p> : null}
      <ul className="space-y-3">
        {links.map((link) => {
          const mine = link.author_id === user.id;
          return (
            <li className="flex gap-4 rounded-2xl border-2 border-stone-900 bg-white p-4 shadow-[3px_3px_0_#1c1917]" data-testid="link-item" key={link.id}>
              <div className="flex flex-col items-center gap-1">
                <button
                  aria-label={`Upvote ${link.title}`}
                  aria-pressed={link.my_vote === 1}
                  className={`h-8 w-8 rounded-lg border-2 border-stone-900 font-black disabled:opacity-30 ${link.my_vote === 1 ? "bg-lime-300" : "bg-white"}`}
                  disabled={mine}
                  onClick={() => void vote(link, 1)}
                  title={mine ? "You can't vote on your own link." : "+1 karma for the author"}
                  type="button"
                >
                  ▲
                </button>
                <span className="font-black" data-testid="link-score">
                  {link.score}
                </span>
                <button
                  aria-label={`Downvote ${link.title}`}
                  aria-pressed={link.my_vote === -1}
                  className={`h-8 w-8 rounded-lg border-2 border-stone-900 font-black disabled:opacity-30 ${link.my_vote === -1 ? "bg-rose-300" : "bg-white"}`}
                  disabled={mine}
                  onClick={() => void vote(link, -1)}
                  title={mine ? "You can't vote on your own link." : "-1 karma for the author"}
                  type="button"
                >
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1">
                {editingId === link.id ? (
                  <LinkForm
                    initial={link}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (fields) => {
                      await postJson("/links/update", { id: link.id, ...fields });
                      setEditingId(null);
                      await load(query);
                    }}
                    submitLabel="Save"
                  />
                ) : (
                  <>
                    <a
                      className="break-words text-lg font-bold underline decoration-yellow-400 decoration-4 underline-offset-2 hover:decoration-stone-900"
                      href={link.url}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                    >
                      {link.title}
                    </a>
                    <p className="truncate text-xs text-stone-500">{linkHost(link.url)}</p>
                    {link.description ? <p className="mt-1 whitespace-pre-wrap break-words text-stone-700">{link.description}</p> : null}
                    <p className="mt-2 text-xs text-stone-600">
                      added by{" "}
                      <Link className="font-bold hover:underline" to={`/u/${link.author_username}`}>
                        @{link.author_username}
                      </Link>{" "}
                      · {formatDate(link.created_at)}
                    </p>
                    {mine || user.is_admin ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        {mine ? (
                          <Button onClick={() => setEditingId(link.id)} variant="secondary">
                            Edit
                          </Button>
                        ) : null}
                        {confirmDeleteId === link.id ? (
                          <>
                            <Button onClick={() => void remove(link)} variant="danger">
                              Really delete?
                            </Button>
                            <Button onClick={() => setConfirmDeleteId(null)} variant="secondary">
                              Keep it
                            </Button>
                          </>
                        ) : (
                          <Button onClick={() => setConfirmDeleteId(link.id)} variant="secondary">
                            {mine ? "Delete" : "Admin delete"}
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
