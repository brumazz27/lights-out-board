import { test, expect } from "@playwright/test";

// Each test gets a fresh browser context, so the browser-only store starts empty every time.

async function fillReport(page, { plate = "", color = "", model = "", issues = [], where = "", notes = "" } = {}) {
  if (plate) await page.getByLabel("Plate (optional)").fill(plate);
  if (color) await page.getByLabel("Color").fill(color);
  if (model) await page.getByLabel("Make & model").fill(model);
  for (const issue of issues) await page.locator(".chip", { hasText: issue }).click();
  if (where) await page.getByLabel("Where you saw it").fill(where);
  if (notes) await page.getByLabel("Notes").fill(notes);
}

const cards = page => page.getByTestId("report-card");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("store-mode")).toHaveAttribute("data-mode", "local");
});

test("opens with an empty board", async ({ page }) => {
  await expect(page).toHaveTitle("Lights Out Board");
  await expect(page.getByText("No sightings yet")).toBeVisible();
  await expect(page.locator("#t-open")).toHaveText("0");
  await expect(page.locator("#t-fixed")).toHaveText("0");
});

test.describe("form validation", () => {
  test("requires at least one problem", async ({ page }) => {
    await fillReport(page, { color: "Red", where: "Main St" });
    await page.getByRole("button", { name: "Post report" }).click();
    await expect(page.locator("#msg")).toHaveText("Pick at least one problem you noticed.");
    await expect(cards(page)).toHaveCount(0);
  });

  test("requires something to recognize the car by", async ({ page }) => {
    await fillReport(page, { issues: ["Low tire"], where: "Main St" });
    await page.getByRole("button", { name: "Post report" }).click();
    await expect(page.locator("#msg")).toHaveText("Add a plate, color or model so the car can be recognized.");
  });

  test("requires a location", async ({ page }) => {
    await fillReport(page, { plate: "7abc123", issues: ["Headlight out"] });
    await page.getByRole("button", { name: "Post report" }).click();
    await expect(page.locator("#msg")).toHaveText("Add where you saw the car.");
  });
});

test("posts a report and shows it in the list", async ({ page }) => {
  await fillReport(page, {
    plate: "7abc123", color: "Silver", model: "Honda Civic",
    issues: ["Tail light out", "Low tire"], where: "5th & Main", notes: "Rear left tire looks soft.",
  });
  await page.getByRole("button", { name: "Post report" }).click();

  await expect(page.locator("#msg")).toHaveText("Posted. Thanks for looking out.");
  const card = cards(page).first();
  await expect(card).toBeVisible();
  await expect(card.locator(".plate")).toContainText("7ABC123"); // plate is upper-cased
  await expect(card).toContainText("Silver Honda Civic");
  await expect(card).toContainText("5th & Main");
  await expect(card.locator(".tag")).toHaveText(["Tail light out", "Low tire"]);
  await expect(card).toContainText("Rear left tire looks soft.");
  await expect(page.locator("#t-open")).toHaveText("1");
  await expect(page.getByLabel("Plate (optional)")).toHaveValue(""); // form resets
});

test("keeps reports after a reload", async ({ page }) => {
  await fillReport(page, { color: "Blue", issues: ["Flat tire"], where: "Library lot" });
  await page.getByRole("button", { name: "Post report" }).click();
  await expect(cards(page)).toHaveCount(1);
  await page.reload();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().locator(".plate")).toContainText("NO PLATE");
});

test("marks a report fixed and reopens it", async ({ page }) => {
  await fillReport(page, { model: "Ford F-150", issues: ["Brake light out"], where: "Elm St" });
  await page.getByRole("button", { name: "Post report" }).click();
  await expect(cards(page)).toHaveCount(1);

  await page.getByRole("button", { name: "Mark fixed" }).click();
  await expect(page.locator("#t-open")).toHaveText("0");
  await expect(page.locator("#t-fixed")).toHaveText("1");
  await expect(cards(page)).toHaveCount(0); // default filter shows open reports only

  await page.getByLabel("Filter by status").selectOption("fixed");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toHaveAttribute("data-status", "fixed");

  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator("#t-open")).toHaveText("1");
});

test("filters by problem type", async ({ page }) => {
  for (const r of [
    { color: "Red", issues: ["Headlight out"], where: "A St" },
    { color: "Green", issues: ["Low tire"], where: "B St" },
  ]) {
    await fillReport(page, r);
    await page.getByRole("button", { name: "Post report" }).click();
    await expect(page.locator("#msg")).toHaveText("Posted. Thanks for looking out.");
  }
  await expect(cards(page)).toHaveCount(2);

  await page.getByLabel("Filter by issue").selectOption("low-tire");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Green");

  await page.getByLabel("Filter by issue").selectOption("signal");
  await expect(page.getByText("Nothing matches")).toBeVisible();
});

test("deletes a report only after a second tap", async ({ page }) => {
  await fillReport(page, { color: "White", issues: ["Cracked lens"], where: "C St" });
  await page.getByRole("button", { name: "Post report" }).click();
  await expect(cards(page)).toHaveCount(1);

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Tap again to delete" }).click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("No sightings yet")).toBeVisible();
});

test("escapes text people type", async ({ page }) => {
  await fillReport(page, { color: "<img src=x onerror=alert(1)>", issues: ["Other"], where: "<b>here</b>" });
  await page.getByRole("button", { name: "Post report" }).click();
  const card = cards(page).first();
  await expect(card).toContainText("<img src=x onerror=alert(1)>");
  await expect(card.locator("img, b")).toHaveCount(0);
});

test("never scrolls sideways", async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
