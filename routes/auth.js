const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const ensureDbReady = (res) => {
  if (!db.isReady || !db.isReady()) {
    res.status(503).json({
      message: "Database is not ready. Please try again in a moment.",
    });
    return false;
  }
  return true;
};

const buildToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );

router.post("/register", async (req, res) => {
  const { name, password } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!ensureDbReady(res)) return;

  try {
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE LOWER(email) = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')",
      [name, email, hashedPassword],
    );

    return res.status(201).json({
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res
      .status(500)
      .json({ message: "Registration failed due to server error" });
  }
});

router.post("/login", async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!process.env.JWT_SECRET) {
    return res
      .status(500)
      .json({ message: "Server auth configuration is missing JWT_SECRET" });
  }

  if (!ensureDbReady(res)) return;

  try {
    const [users] = await db.query(
      "SELECT id, name, email, password, role FROM users WHERE LOWER(email) = ?",
      [email],
    );

    if (users.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = buildToken(user);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ message: "Login failed due to server error" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user: users[0] });
  } catch (error) {
    console.error("ME ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch user profile" });
  }
});

router.post(
  "/create-user",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const { name, password, role } = req.body;
    const email = normalizeEmail(req.body.email);
    const safeRole = role === "admin" ? "admin" : "user";

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    try {
      const [existingUsers] = await db.query(
        "SELECT id FROM users WHERE LOWER(email) = ?",
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
      console.error("CREATE USER ERROR:", error);
      return res.status(500).json({ message: "Failed to create user" });
    }
  },
);

module.exports = router;
