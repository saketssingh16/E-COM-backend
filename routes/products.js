const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

router.get("/", async (req, res) => {
  try {
    const [products] = await db.query(
      "SELECT id, name, price, category, image, description, stock, created_at FROM products ORDER BY id DESC",
    );
    return res.json({ products });
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [products] = await db.query(
      "SELECT id, name, price, category, image, description, stock, created_at FROM products WHERE id = ? LIMIT 1",
      [req.params.id],
    );

    if (!products.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ product: products[0] });
  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch product" });
  }
});

router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  const { name, price, category, image, description, stock } = req.body;

  if (!name || price == null || !category || !image) {
    return res
      .status(400)
      .json({ message: "name, price, category and image are required" });
  }

  try {
    await db.query(
      `INSERT INTO products (name, price, category, image, description, stock)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, Number(price), category, image, description || "", Number(stock || 0)],
    );

    return res.status(201).json({ message: "Product created successfully" });
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);
    return res.status(500).json({ message: "Failed to create product" });
  }
});

router.put("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const { name, price, category, image, description, stock } = req.body;
  if (!name || price == null || !category || !image) {
    return res
      .status(400)
      .json({ message: "name, price, category and image are required" });
  }

  try {
    const [result] = await db.query(
      `UPDATE products
       SET name = ?, price = ?, category = ?, image = ?, description = ?, stock = ?
       WHERE id = ?`,
      [
        name,
        Number(price),
        category,
        image,
        description || "",
        Number(stock || 0),
        req.params.id,
      ],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);
    return res.status(500).json({ message: "Failed to update product" });
  }
});

router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM products WHERE id = ?", [
      req.params.id,
    ]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

module.exports = router;
