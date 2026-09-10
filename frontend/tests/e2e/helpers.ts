/*
This file keeps shared Playwright helpers: unique test users, reading email links from the dev outbox, and logging in.
Edit this file when the sign-up, confirmation, or login flow used by e2e tests changes.
Copy the helper style here when you add another shared e2e helper.
*/

import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const TEST_PASSWORD = "password123";

export type TestUser = { username: string; email: string; password: string };

export function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.slice(0, 20);
}

export async function readEmailToken(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await request.post("/api/dev/outbox", { data: {} });
    const payload = (await response.json()) as { data: { messages: Array<{ to: string; body: string }> } };
    const message = payload.data.messages.find((item) => item.to === email);
    const match = message ? /token=([A-Za-z0-9_-]+)/.exec(message.body) : null;
    if (match) {
      return match[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email was sent to ${email}.`);
}

export async function createConfirmedUser(request: APIRequestContext, prefix: string): Promise<TestUser> {
  const username = uniqueName(prefix);
  const user = { username, email: `${username.toLowerCase()}@example.edu`, password: TEST_PASSWORD };
  const registered = await request.post("/api/auth/register", { data: user });
  expect(registered.ok()).toBeTruthy();
  const confirmed = await request.post("/api/auth/confirm", { data: { token: await readEmailToken(request, user.email) } });
  expect(confirmed.ok()).toBeTruthy();
  return user;
}

/** A link in the top navigation bar. Home page cards and nickname links can have similar names. */
export function navLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });
}

export async function loginInBrowser(page: Page, user: { username: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Nickname").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("heading", { name: `hi, ${user.username} 👋` })).toBeVisible();
}
