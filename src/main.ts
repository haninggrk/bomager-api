import express, { Request, Response } from 'express';
import { chromium, firefox } from "playwright";
import { constValue } from "./helpers/const";

const app = express();
const PORT = process.env.PORT || 3606;
const MAX_CONCURRENT_BROWSERS = 5;

app.use(express.json());

async function validateVoucher(voucher: string) {
    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        await page.goto(constValue.VOUCHER_DETAIL_PAGE_URL);
        
        await page.fill('input[name="firstname"]', "John");
        await page.fill('input[name="lastname"]', "Doe");
        await page.fill('input[name="email"]', "test@example.com");
        await page.fill('input[name="address1"]', "Street Street");
        await page.fill('input[name="city"]', "City");
        await page.fill('input[name="phoneNumber"]', "1234567890");
        await page.click('button[name="book"]');

        await page.fill('input[name="coupon_code_input"]', voucher);
        
        const submitButton = await page.$('button.bui-button.bui-button--secondary.bui-u-margin-top--8.js-aob--form-submit');
        if (!submitButton) throw new Error("Voucher submission button not found");
        await submitButton.click();

        const response = await page.waitForResponse(constValue.VOUCHER_VALIDATE_URL);
        const responseBody = JSON.parse(await response.text());

        return {
            voucher,
            valid: responseBody.valid ? 1 : 0,
            message: responseBody.error_messages?.[0] || "N/A",
            expiry_date: responseBody.formatted_expiry_date || "N/A",
        };
    } catch (error) {
        console.error(`Error validating voucher ${voucher}:`, error);
        return { voucher, valid: 0, message: "Error", expiry_date: "N/A" };
    } finally {
        await browser.close();
    }
}

app.post("/validate", async (req: Request , res:Response ): Promise<any> => {
    const { vouchers } = req.body;
    console.log(vouchers);
    if (!Array.isArray(vouchers) || vouchers.length === 0) {
        return res.status(400).json({ error: "Invalid vouchers input" });
    }
    const results = [];
    for (let i = 0; i < vouchers.length; i += MAX_CONCURRENT_BROWSERS) {
        const batch = vouchers.slice(i, i + MAX_CONCURRENT_BROWSERS).map(validateVoucher);
        results.push(...(await Promise.all(batch)));
    }
    res.json(results);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
