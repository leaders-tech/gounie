/*
This file checks what visitors without an account can do: read the public pages and log in from the home page.
Edit this file when public pages or the visitor home page change.
Copy a test pattern here when you add another page that visitors may open.
*/

import { expect, test } from "@playwright/test";
import { createConfirmedUser, navLink, TEST_PASSWORD } from "./helpers";

test("visitors read the public pages, cannot act, and can log in from the home page", async ({ page, request }) => {
  const user = await createConfirmedUser(request, "vis");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "gounie", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  await expect(navLink(page, "The Wall")).toHaveCount(0);
  await expect(navLink(page, "Slots")).toHaveCount(0);

  await navLink(page, "Is it Friday yet?").click();
  await expect(page.getByTestId("friday-answer")).toHaveText(/^(NO|YES!)$/);

  await navLink(page, "EPS-bet").click();
  await expect(page.getByRole("heading", { name: "EPS-bet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ New bet" })).toHaveCount(0);
  await expect(page.getByText(/Log in.*to place a bet/)).toBeVisible();

  await navLink(page, "URLs").click();
  await expect(page.getByRole("heading", { name: "the great url collection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add link" })).toHaveCount(0);
  await expect(page.getByText(/to add links and to vote/)).toBeVisible();

  await page.goto("/wall");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "gounie", exact: true })).toHaveCount(0);

  await page.goto("/");
  await page.getByLabel("Nickname").fill(user.username);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("heading", { name: `hi, ${user.username} 👋` })).toBeVisible();
  await expect(navLink(page, "Slots")).toHaveCount(1);
});
