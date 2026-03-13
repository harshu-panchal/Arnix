import { test, expect } from "@playwright/test";

test("Seller UI smoke: orders, order detail, products, add product, stock", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Ignore noisy browser errors that don't usually indicate a React crash.
    if (/Failed to load resource/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // Login
  await page.goto("/seller/login");
  await expect(page.getByText("Seller Login")).toBeVisible();

  await page.getByPlaceholder("Enter mobile number").fill("9111966732");
  const sendOtpResponsePromise = page.waitForResponse((r) => {
    return r.url().includes("/auth/seller/send-otp") && r.request().method() === "POST";
  });
  await page.getByRole("button", { name: "Continue" }).click();
  const sendOtpResponse = await sendOtpResponsePromise;
  const sendOtpJson: any = await sendOtpResponse.json().catch(() => null);
  if (!sendOtpResponse.ok() || !sendOtpJson?.success) {
    throw new Error(
      `send-otp failed: http=${sendOtpResponse.status()} body=${JSON.stringify(sendOtpJson)}`
    );
  }

  const otpInputs = page.locator('input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 30_000 });
  const otp = "1234";
  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  await page.waitForURL(/\/seller\/?$/);

  // SellerOrders
  await page.goto("/seller/orders");
  await expect(page.getByText("View Order List")).toBeVisible();

  const viewButtons = page.getByRole("button", { name: "View" });
  if (await viewButtons.count()) {
    await viewButtons.first().click();
    await page.waitForURL(/\/seller\/orders\/.+/);
    await expect(page.getByText("View Order Details")).toBeVisible();
  }

  // SellerProductList
  await page.goto("/seller/product/list");
  await expect(page.getByText("View Product List")).toBeVisible();

  // SellerAddProduct (just ensure the form renders)
  await page.goto("/seller/product/add");
  await expect(page.getByRole("button", { name: "Add Product" })).toBeVisible();

  // SellerStockManagement
  await page.goto("/seller/product/stock");
  await expect(page.getByText("View Stock Management")).toBeVisible();

  // Fail if we hit runtime exceptions
  expect(pageErrors, `Uncaught page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
