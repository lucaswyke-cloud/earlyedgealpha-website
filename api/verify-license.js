// api/verify-license.js
// Vercel serverless function — checks if an email has an active Stripe subscription.
//
// Environment variable required (set in Vercel dashboard):
//   STRIPE_SECRET_KEY  →  your Stripe secret key (sk_live_...)

export default async function handler(req, res) {
  // CORS — allow your extension and site
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body || {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ valid: false, error: "Invalid email" });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ valid: false, error: "Server misconfigured" });
  }

  try {
    // 1. Find customer by email
    const customerRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email.toLowerCase())}&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${stripeKey}`,
        },
      }
    );
    const customerData = await customerRes.json();

    if (!customerData.data || customerData.data.length === 0) {
      return res.status(200).json({ valid: false });
    }

    // 2. Check each customer for an active subscription
    for (const customer of customerData.data) {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=active&limit=5`,
        {
          headers: {
            Authorization: `Bearer ${stripeKey}`,
          },
        }
      );
      const subData = await subRes.json();

      if (subData.data && subData.data.length > 0) {
        return res.status(200).json({ valid: true });
      }
    }

    // No active subscription found
    return res.status(200).json({ valid: false });

  } catch (err) {
    console.error("License check error:", err);
    return res.status(500).json({ valid: false, error: "Server error" });
  }
}
