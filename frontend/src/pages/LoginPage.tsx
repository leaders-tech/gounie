/*
This file shows the login page: nickname and password, plus resending the confirmation email.
Edit this file when login UI, login errors, or login redirect behavior changes.
Copy this file as a starting point when you add another simple form page.
*/

import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth";
import { ApiError, errorMessage, postJson } from "../shared/api";
import { Button, Card, ErrorText, InfoText, TextField } from "../shared/ui";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    setNeedsConfirmation(false);
    try {
      await login(username, password);
      navigate("/");
    } catch (submitError) {
      setError(errorMessage(submitError, "Login failed."));
      setNeedsConfirmation(submitError instanceof ApiError && submitError.code === "email_not_confirmed");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    setError("");
    try {
      await postJson("/auth/resend-confirmation", { username });
      setInfo("We sent you a new confirmation email.");
      setNeedsConfirmation(false);
    } catch (resendError) {
      setError(errorMessage(resendError));
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-3xl font-black">Login</h1>
      <p className="mt-1 text-sm text-stone-600">Welcome back to gounie.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <TextField autoComplete="username" label="Nickname" onChange={(event) => setUsername(event.target.value)} value={username} />
        <TextField autoComplete="current-password" label="Password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
        <ErrorText>{error}</ErrorText>
        {needsConfirmation ? (
          <Button onClick={() => void resendConfirmation()} variant="secondary">
            Resend confirmation email
          </Button>
        ) : null}
        <InfoText>{info}</InfoText>
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? "Logging in..." : "Login"}
        </Button>
      </form>
      <div className="mt-6 flex justify-between text-sm font-semibold">
        <Link className="underline" to="/register">
          Create an account
        </Link>
        <Link className="underline" to="/forgot-password">
          Forgot password?
        </Link>
      </div>
    </Card>
  );
}
