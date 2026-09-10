/*
This file shows the sign-up page: nickname, school email, and password, then a "check your inbox" message.
Edit this file when sign-up fields, sign-up errors, or the after-sign-up message changes.
Copy this file as a starting point when you add another form page with a success screen.
*/

import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../app/auth";
import { errorMessage, postJson } from "../shared/api";
import { Button, Card, ErrorText, InfoText, TextField } from "../shared/ui";

export function RegisterPage() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password !== repeatPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson<{ registered: boolean; email_sent: boolean }>("/auth/register", { username, email, password });
      setEmailSent(data.email_sent);
    } catch (submitError) {
      setError(errorMessage(submitError, "Sign-up failed."));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    setInfo("");
    try {
      await postJson("/auth/resend-confirmation", { username });
      setInfo("We sent you a new confirmation email.");
    } catch (resendError) {
      setError(errorMessage(resendError));
    }
  };

  if (emailSent !== null) {
    return (
      <Card className="mx-auto max-w-md space-y-4">
        <h1 className="text-3xl font-black">Check your inbox 📬</h1>
        {emailSent ? (
          <p>
            We sent a confirmation link to <strong>{email}</strong>. Open it to finish signing up, then log in.
          </p>
        ) : (
          <p>Your account was created, but we could not send the email. Wait a minute and try sending it again.</p>
        )}
        <ErrorText>{error}</ErrorText>
        <InfoText>{info}</InfoText>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void resend()} variant="secondary">
            Send the email again
          </Button>
          <Link className="rounded-xl border-2 border-stone-900 bg-yellow-300 px-4 py-2 font-bold" to="/login">
            Go to login
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-3xl font-black">Create an account</h1>
      <p className="mt-1 text-sm text-stone-600">Only school emails can be used. You will need to confirm your email.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <TextField
          autoComplete="username"
          hint="3-20 characters: letters, numbers, or _. You can't change it later."
          label="Nickname"
          onChange={(event) => setUsername(event.target.value)}
          required
          value={username}
        />
        <TextField autoComplete="email" label="School email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <TextField
          autoComplete="new-password"
          hint="At least 8 characters."
          label="Password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <TextField
          autoComplete="new-password"
          label="Repeat password"
          onChange={(event) => setRepeatPassword(event.target.value)}
          required
          type="password"
          value={repeatPassword}
        />
        <ErrorText>{error}</ErrorText>
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? "Creating..." : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm font-semibold">
        Already have an account?{" "}
        <Link className="underline" to="/login">
          Log in
        </Link>
      </p>
    </Card>
  );
}
