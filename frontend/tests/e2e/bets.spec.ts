/*
This file checks EPS-bet in real browsers: proposing a bet, the admin approving it, another user wagering, and the live discussion.
Edit this file when the bet browser flow changes.
Copy a test pattern here when you add another e2e flow with karma changes.
*/

import { expect, test } from "@playwright/test";
import { createConfirmedUser, loginInBrowser, navLink, uniqueName } from "./helpers";

test("a new bet waits for the admin, then another user bets and discusses it live", async ({ browser, request }) => {
  const creator = await createConfirmedUser(request, "cre");
  const bettor = await createConfirmedUser(request, "bet");
  const creatorPage = await (await browser.newContext()).newPage();
  const bettorPage = await (await browser.newContext()).newPage();
  const adminPage = await (await browser.newContext()).newPage();
  const title = `Will e2e pass today ${uniqueName("q")}?`;

  await loginInBrowser(creatorPage, creator);
  await navLink(creatorPage, "EPS-bet").click();
  await creatorPage.getByRole("button", { name: "+ New bet" }).click();
  await creatorPage.getByLabel("Question").fill(title);
  await creatorPage.getByLabel("Details (optional)").fill("Only green tests count.");
  await creatorPage.getByRole("button", { name: "Create bet" }).click();
  await expect(creatorPage.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(creatorPage.getByText(/An admin still has to read this bet/)).toBeVisible();

  // Nobody else sees the bet before it is approved.
  await loginInBrowser(bettorPage, bettor);
  await bettorPage.goto(new URL(creatorPage.url()).pathname);
  await expect(bettorPage.getByText("This bet does not exist.")).toBeVisible();

  await loginInBrowser(adminPage, { username: "admin", password: process.env.E2E_ADMIN_PASSWORD ?? "" });
  await navLink(adminPage, "Admin").click();
  const waiting = adminPage.getByRole("listitem").filter({ hasText: title });
  await expect(waiting).toBeVisible();
  await waiting.getByLabel("Note for the creator (optional)").fill("Good question!");
  await waiting.getByRole("button", { name: "Approve and publish" }).click();
  await expect(adminPage.getByRole("status")).toContainText("approved and published");

  await bettorPage.reload();
  await bettorPage.getByRole("button", { name: "NO", exact: true }).click();
  await bettorPage.getByLabel("Stake (karma)").fill("7");
  await bettorPage.getByRole("button", { name: "Place bet" }).click();
  await expect(bettorPage.getByText(/Now wait for the outcome/)).toBeVisible();
  await expect(bettorPage.getByTestId("header-karma")).toHaveText("-7 karma");

  await bettorPage.getByLabel("Your message").fill("No way this passes.");
  await bettorPage.getByRole("button", { name: "Post message" }).click();
  await expect(bettorPage.getByText("No way this passes.")).toBeVisible();

  await expect(creatorPage.getByText("No way this passes.")).toBeVisible();
  await expect(creatorPage.getByText("NO · 7 karma")).toBeVisible();
});

test("a declined bet never goes live and the creator is told why", async ({ browser, request }) => {
  const creator = await createConfirmedUser(request, "dec");
  const creatorPage = await (await browser.newContext()).newPage();
  const adminPage = await (await browser.newContext()).newPage();
  const title = `Should we all skip class ${uniqueName("q")}?`;

  await loginInBrowser(creatorPage, creator);
  await navLink(creatorPage, "EPS-bet").click();
  await creatorPage.getByRole("button", { name: "+ New bet" }).click();
  await creatorPage.getByLabel("Question").fill(title);
  await creatorPage.getByRole("button", { name: "Create bet" }).click();
  await expect(creatorPage.getByText(/An admin still has to read this bet/)).toBeVisible();

  await loginInBrowser(adminPage, { username: "admin", password: process.env.E2E_ADMIN_PASSWORD ?? "" });
  await navLink(adminPage, "Admin").click();
  const waiting = adminPage.getByRole("listitem").filter({ hasText: title });
  await waiting.getByLabel("Note for the creator (optional)").fill("Please no.");
  await waiting.getByRole("button", { name: "Decline" }).click();
  await expect(adminPage.getByRole("status")).toContainText("was declined");

  await creatorPage.reload();
  await expect(creatorPage.getByText(/This bet was not approved/)).toBeVisible();
  await expect(creatorPage.getByText(/Please no./)).toBeVisible();
  await navLink(creatorPage, "EPS-bet").click();
  await expect(creatorPage.getByRole("heading", { name: "Your bets that were not approved" })).toBeVisible();
});
