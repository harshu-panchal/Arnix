import { test, expect } from "@playwright/test";

test("Admin UI smoke: login, orders, categories, customers, users, coupons, payments, delivery, sellers", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  const adminMobile = process.env.PW_ADMIN_MOBILE || "9876543210";
  const otp = process.env.PW_ADMIN_OTP || "1234";

  await page.goto("/admin/login");
  await expect(page.getByText("Admin Login")).toBeVisible();

  await page.getByPlaceholder("Enter mobile number").fill(adminMobile);

  const sendOtpResponsePromise = page.waitForResponse((r) => {
    return r.url().includes("/auth/admin/send-otp") && r.request().method() === "POST";
  });
  await page.getByRole("button", { name: "Continue" }).click();
  const sendOtpResponse = await sendOtpResponsePromise;
  const sendOtpJson: any = await sendOtpResponse.json().catch(() => null);
  if (!sendOtpResponse.ok() || !sendOtpJson?.success) {
    throw new Error(
      `admin send-otp failed: http=${sendOtpResponse.status()} body=${JSON.stringify(sendOtpJson)}`
    );
  }

  const otpInputs = page.locator('input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  await page.waitForURL(/\/admin\/?$/);

  // Orders
  await page.goto("/admin/orders/all");
  await expect(page.getByRole("heading", { name: "Orders List" })).toBeVisible();

  // Open first order detail if present (there should be some orders in seed data)
  const firstOrderLink = page.locator('a[href^="/admin/orders/"]').first();
  if (await firstOrderLink.count()) {
    await firstOrderLink.click();
    await page.waitForURL(/\/admin\/orders\/[a-f0-9]{24}$/);
    await expect(page.getByText("Order Details")).toBeVisible();
  }

  // Categories
  await page.goto("/admin/category");
  await expect(page.getByRole("heading", { name: "Manage Categories" })).toBeVisible();

  // Customers
  await page.goto("/admin/customers");
  await expect(page.getByRole("heading", { name: "Manage Customer" })).toBeVisible();

  // Users list
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "User List" })).toBeVisible();

  // Coupons
  await page.goto("/admin/coupon");
  await expect(page.getByRole("heading", { name: "Coupon" })).toBeVisible();

  // Payment Methods
  await page.goto("/admin/payment-list");
  await expect(page.getByRole("heading", { name: "Payment Method" })).toBeVisible();

  // Delivery Boy Management
  await page.goto("/admin/delivery-boy/manage");
  await expect(page.getByText("View Delivery Boy List")).toBeVisible();

  // Seller Management
  await page.goto("/admin/manage-seller/list");
  await expect(page.getByText("View Seller List")).toBeVisible();

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
