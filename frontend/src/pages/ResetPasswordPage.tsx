/*
This file opens the password reset link (/reset?token=...) and lets the user choose a new password.
Edit this file when the reset-password form or its messages change.
Copy this file as a starting point when you add another form page that uses a token from a link.
*/

import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage, postJson } from "../shared/api";
import { Button, Card, ErrorText, InfoText, TextField } from "../shared/ui";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password !== repeatPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await postJson("/auth/reset-password", { token, password });
      setDone(true);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-3xl font-black">Choose a new password</h1>
      {done ? (
        <div className="mt-4 space-y-4">
          <InfoText>Your password was changed. You can log in now.</InfoText>
          <Link className="inline-block rounded-xl border-2 border-stone-900 bg-yellow-300 px-4 py-2 font-bold" to="/login">
            Go to login
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {!token ? <ErrorText>This reset link is missing its token.</ErrorText> : null}
          <TextField
            autoComplete="new-password"
            hint="At least 8 characters."
            label="New password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          <TextField
            autoComplete="new-password"
            label="Repeat new password"
            onChange={(event) => setRepeatPassword(event.target.value)}
            type="password"
            value={repeatPassword}
          />
          <ErrorText>{error}</ErrorText>
          <Button className="w-full" disabled={busy || !token} type="submit">
            {busy ? "Saving..." : "Save new password"}
          </Button>
        </form>
      )}
    </Card>
  );
}
