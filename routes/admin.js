const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

router.use(authMiddleware, requireRole("admin"));

router.get("/stats", async (req, res) => {
  try {
    const [[usersAgg]] = await db.query(
      "SELECT COUNT(*) AS totalUsers FROM users WHERE role = 'user'",
    );
    const [[productsAgg]] = await db.query(
      "SELECT COUNT(*) AS totalProducts FROM products",
    );
    const [[ordersAgg]] = await db.query(
      "SELECT COUNT(*) AS totalOrders, IFNULL(SUM(total_amount), 0) AS revenue FROM orders WHERE status != 'cancelled'",
    );
    const [[salesAgg]] = await db.query(
      "SELECT IFNULL(SUM(quantity), 0) AS unitsSold FROM order_items",
    );

    return res.json({
      stats: {
        totalUsers: Number(usersAgg.totalUsers || 0),
        totalProducts: Number(productsAgg.totalProducts || 0),
        totalOrders: Number(ordersAgg.totalOrders || 0),
        unitsSold: Number(salesAgg.unitsSold || 0),
        revenue: Number(ordersAgg.revenue || 0),
      },
    });
  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch stats" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY id DESC",
    );
    return res.json({ users });
  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.post("/users", async (req, res) => {
  const { name, email, password, role } = req.body;
  const safeRole = role === "admin" ? "admin" : "user";

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }

  try {
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, safeRole],
    );
    return res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("ADMIN CREATE USER ERROR:", error);
    return res.status(500).json({ message: "Failed to create user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ message: "Admin cannot delete own account." });
  }

  try {
    const [result] = await db.query("DELETE FROM users WHERE id = ?", [targetId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("ADMIN DELETE USER ERROR:", error);
    return res.status(500).json({ message: "Failed to delete user" });
  }
});

module.exports = router;
