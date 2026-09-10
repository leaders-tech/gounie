/*
This file opens the email confirmation link (/confirm?token=...) and tells the user if it worked.
Edit this file when the email confirmation page or its messages change.
Copy this file as a starting point when you add another page that runs one action from a link.
*/

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage, postJson } from "../shared/api";
import { Card, ErrorText, InfoText } from "../shared/ui";

export function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "done" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "This confirmation link is missing its token.");
  const started = useRef(false);

  useEffect(() => {
    // The token works only once, so make sure React StrictMode does not send it twice.
    if (!token || started.current) {
      return;
    }
    started.current = true;
    postJson<{ confirmed: boolean; username: string }>("/auth/confirm", { token })
      .then((data) => {
        setState("done");
        setMessage(`Your email is confirmed, ${data.username}! You can log in now.`);
      })
      .catch((confirmError) => {
        setState("error");
        setMessage(errorMessage(confirmError));
      });
  }, [token]);

  return (
    <Card className="mx-auto max-w-md space-y-4">
      <h1 className="text-3xl font-black">Email confirmation</h1>
      {state === "loading" ? <p>Checking your link...</p> : null}
      {state === "done" ? <InfoText>{message}</InfoText> : null}
      {state === "error" ? <ErrorText>{message}</ErrorText> : null}
      {state !== "loading" ? (
        <Link className="inline-block rounded-xl border-2 border-stone-900 bg-yellow-300 px-4 py-2 font-bold" to="/login">
          Go to login
        </Link>
      ) : null}
    </Card>
  );
}
