const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Prices must match your website menu
const MENU = {
  "Breakfast": [
    20, 30, 40, 50, 20, 10, 20, 30, 30, 50, 10, 40,
    25, 40, 30, 20, 80, 80, 80, 30, 40, 50
  ],
  "Snacks": [
    60, 80, 120, 150, 20, 80, 100, 120, 300, 20, 40,
    100, 150, 180, 120, 150, 180, 180, 60, 30, 10, 40, 25, 40
  ],
  "Lunch & Dinner": [120, 180],
  "Tea & Beverages": [20, 30, 30, 80, 40, 20, 80]
};

const DELIVERY_CHARGE = 50;

// Create Razorpay order
app.post("/api/create-order", async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({
        error: "Razorpay credentials are not configured yet."
      });
    }

    const items = req.body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No order items received." });
    }

    let total = 0;

    for (const item of items) {
      const category = MENU[item.category];
      const index = Number(item.index);
      const quantity = Number(item.quantity);

      if (
        !category ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= category.length ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {
        return res.status(400).json({ error: "Invalid order item." });
      }

      total += category[index] * quantity;
    }

    total += DELIVERY_CHARGE;

    const amountPaise = total * 100;

    const auth = Buffer.from(
      keyId + ":" + keySecret
    ).toString("base64");

    const razorpayResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + auth
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: "SK" + Date.now()
        })
      }
    );

    const data = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error("Razorpay order error:", data);
      return res.status(500).json({
        error: "Razorpay could not create the payment order."
      });
    }

    res.json({
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
      key_id: keyId
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Could not create payment order."
    });
  }
});

// Verify successful Razorpay payment
app.post("/api/verify-payment", (req, res) => {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res.status(500).json({
        error: "Razorpay secret is not configured."
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        error: "Payment information is incomplete."
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(
        razorpay_order_id + "|" + razorpay_payment_id
      )
      .digest("hex");

    const valid =
      expectedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
      );

    if (!valid) {
      return res.status(400).json({
        error: "Payment verification failed."
      });
    }

    res.json({
      success: true,
      payment_id: razorpay_payment_id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Payment verification error."
    });
  }
});

// GoDaddy health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Website files
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Singh Kitchen server started");
});
