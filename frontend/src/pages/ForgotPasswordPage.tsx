/*
This file shows the "forgot password" page that emails a password reset link.
Edit this file when the forgot-password form or its messages change.
Copy this file as a starting point when you add another one-field form page.
*/

import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, postJson } from "../shared/api";
import { Button, Card, ErrorText, InfoText, TextField } from "../shared/ui";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postJson("/auth/forgot-password", { email });
      setSent(true);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-3xl font-black">Forgot password</h1>
      {sent ? (
        <div className="mt-4 space-y-4">
          <InfoText>If this email belongs to an account, we sent a password reset link. The link works for 1 hour.</InfoText>
          <Link className="inline-block font-semibold underline" to="/login">
            Back to login
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <TextField autoComplete="email" label="School email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          <ErrorText>{error}</ErrorText>
          <Button className="w-full" disabled={busy} type="submit">
            {busy ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
    </Card>
  );
}
