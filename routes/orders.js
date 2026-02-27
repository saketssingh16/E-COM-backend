const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const calculateShipping = (subtotal) => (subtotal > 999 ? 0 : subtotal > 0 ? 99 : 0);

router.post("/", authMiddleware, async (req, res) => {
  const { cartItems } = req.body;
  if (!Array.isArray(cartItems) || !cartItems.length) {
    return res.status(400).json({ message: "cartItems is required" });
  }

  const normalizedItems = cartItems.map((item) => ({
    productId: Number(item.id),
    productName: item.name,
    quantity: Math.max(1, Number(item.quantity) || 1),
    price: Number(item.price) || 0,
  }));

  const subtotal = normalizedItems.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );
  const shippingAmount = calculateShipping(subtotal);
  const totalAmount = subtotal + shippingAmount;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      "INSERT INTO orders (user_id, total_amount, shipping_amount, status) VALUES (?, ?, ?, 'placed')",
      [req.user.id, totalAmount, shippingAmount],
    );
    const orderId = orderResult.insertId;

    for (const item of normalizedItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.productId || null, item.productName, item.quantity, item.price],
      );
    }

    await connection.commit();
    return res.status(201).json({ message: "Order placed", orderId });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("PLACE ORDER ERROR:", error);
    return res.status(500).json({ message: "Failed to place order" });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/my", authMiddleware, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT
        o.id,
        o.total_amount,
        o.shipping_amount,
        o.status,
        o.created_at,
        oi.product_name,
        oi.quantity,
        oi.price_at_purchase
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, oi.id DESC`,
      [req.user.id],
    );

    return res.json({ orders });
  } catch (error) {
    console.error("MY ORDERS ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

module.exports = router;
