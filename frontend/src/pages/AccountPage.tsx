/*
This file shows the account page with the user's info and the change-password form.
Edit this file when account settings or the change-password form changes.
Copy this file as a starting point when you add another logged-in settings page.
*/

import { FormEvent, useState } from "react";
import { useAuth } from "../app/auth";
import { errorMessage, postJson } from "../shared/api";
import { Avatar } from "../shared/Avatar";
import { formatDate } from "../shared/format";
import { Button, Card, ErrorText, InfoText, PageTitle, TextField } from "../shared/ui";

export function AccountPage() {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return null;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (newPassword !== repeatPassword) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await postJson("/auth/change-password", { old_password: oldPassword, new_password: newPassword });
      setInfo("Your password was changed.");
      setOldPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <PageTitle title="Account" />
      <Card className="flex items-center gap-4">
        <Avatar size="lg" username={user.username} />
        <div>
          <p className="text-2xl font-black">{user.username}</p>
          <p className="text-stone-600">
            {user.karma} karma · joined {formatDate(user.created_at)}
          </p>
          <p className="mt-1 text-xs text-stone-500">Avatars are plain on purpose. No profile pictures here.</p>
        </div>
      </Card>
      <Card>
        <h2 className="text-xl font-black">Change password</h2>
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <TextField
            autoComplete="current-password"
            label="Current password"
            onChange={(event) => setOldPassword(event.target.value)}
            type="password"
            value={oldPassword}
          />
          <TextField
            autoComplete="new-password"
            hint="At least 8 characters."
            label="New password"
            onChange={(event) => setNewPassword(event.target.value)}
            type="password"
            value={newPassword}
          />
          <TextField
            autoComplete="new-password"
            label="Repeat new password"
            onChange={(event) => setRepeatPassword(event.target.value)}
            type="password"
            value={repeatPassword}
          />
          <ErrorText>{error}</ErrorText>
          <InfoText>{info}</InfoText>
          <Button disabled={busy} type="submit">
            {busy ? "Saving..." : "Change password"}
          </Button>
        </form>
      </Card>
    </section>
  );
}
