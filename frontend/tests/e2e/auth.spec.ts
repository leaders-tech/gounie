/*
This file checks the account browser flows: sign-up, email confirmation, login, logout, blocked domains, and admin access.
Edit this file when the real account flow changes across pages, cookies, or redirects.
Copy a test pattern here when you add another end-to-end browser flow.
*/

import { expect, test } from "@playwright/test";
import { createConfirmedUser, loginInBrowser, navLink, readEmailToken, TEST_PASSWORD, uniqueName } from "./helpers";

test("new user can register, confirm the email, log in, and log out", async ({ page }) => {
  const username = uniqueName("reg");
  const email = `${username}@example.edu`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Nickname").fill(username);
  await page.getByLabel("School email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Repeat password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox 📬" })).toBeVisible();

  await page.getByRole("link", { name: "Go to login" }).click();
  await page.getByLabel("Nickname").fill(username);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("alert")).toContainText("Please confirm your email first.");
  await expect(page.getByRole("button", { name: "Resend confirmation email" })).toBeVisible();

  await page.goto(`/confirm?token=${await readEmailToken(page.request, email)}`);
  await expect(page.getByText(`Your email is confirmed, ${username}! You can log in now.`)).toBeVisible();

  await loginInBrowser(page, { username, password: TEST_PASSWORD });
  await expect(page.getByTestId("header-karma")).toHaveText("0 karma");
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});

test("sign-up with an email outside the allowed domains is rejected", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Nickname").fill(uniqueName("bad"));
  await page.getByLabel("School email").fill("someone@gmail.com");
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Repeat password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toHaveText("Only emails from allowed school domains can be used.");
});

test("normal user cannot open the admin page, the admin account can", async ({ page, request }) => {
  const user = await createConfirmedUser(request, "nor");
  await loginInBrowser(page, user);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: `hi, ${user.username} 👋` })).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();

  await loginInBrowser(page, { username: "admin", password: process.env.E2E_ADMIN_PASSWORD ?? "" });
  await navLink(page, "Admin").click();
  await expect(page.getByRole("heading", { name: "Admin page" })).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();
});
