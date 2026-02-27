const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

const connectionUrl =
  process.env.MYSQL_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  "";

const getDbConfig = () => {
  if (connectionUrl && connectionUrl.includes("://")) {
    try {
      const parsed = new URL(connectionUrl);
      return {
        host: parsed.hostname,
        user: decodeURIComponent(parsed.username || ""),
        password: decodeURIComponent(parsed.password || ""),
        database: decodeURIComponent((parsed.pathname || "").replace(/^\//, "")),
        port: Number(parsed.port || 3306),
      };
    } catch (error) {
      console.error("Invalid DB URL. Falling back to MYSQL* variables.");
    }
  }

  if (connectionUrl && !connectionUrl.includes("://")) {
    return {
      host: connectionUrl,
      user: process.env.MYSQLUSER || process.env.DB_USER || "root",
      password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
      database: process.env.MYSQLDATABASE || process.env.DB_NAME || "",
      port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    };
  }

  return {
    host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
    user: process.env.MYSQLUSER || process.env.DB_USER || "root",
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || "",
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
  };
};

const dbConfig = getDbConfig();

const useSsl =
  process.env.MYSQL_SSL === "true" ||
  process.env.NODE_ENV === "production";

const db = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

let dbReady = false;

const ensureAdminUser = async (connection) => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@ecom.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@12345";
  const adminName = process.env.ADMIN_NAME || "Platform Admin";

  const [existing] = await connection.query(
    "SELECT id, role FROM users WHERE email = ? LIMIT 1",
    [adminEmail],
  );
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  if (!existing.length) {
    await connection.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
      [adminName, adminEmail, hashedPassword],
    );
    console.log(`Seeded admin user: ${adminEmail}`);
    return;
  }

  await connection.query(
    "UPDATE users SET name = ?, password = ?, role = 'admin' WHERE id = ?",
    [adminName, hashedPassword, existing[0].id],
  );
  console.log(`Synced admin credentials for: ${adminEmail}`);
};

const ensureDefaultProducts = async (connection) => {
  const [[agg]] = await connection.query(
    "SELECT COUNT(*) AS totalProducts FROM products",
  );
  if (Number(agg.totalProducts || 0) > 0) return;

  const categories = ["Men", "Women", "Kids", "Accessories", "Footwear"];
  const baseProducts = [];

  for (let i = 1; i <= 24; i += 1) {
    baseProducts.push([
      `Starter Product ${i}`,
      499 + i * 50,
      categories[(i - 1) % categories.length],
      `https://loremflickr.com/700/900/fashion,clothing?lock=${2000 + i}`,
      "Admin-manageable starter product",
      20 + i,
    ]);
  }

  await connection.query(
    `INSERT INTO products (name, price, category, image, description, stock)
     VALUES ?`,
    [baseProducts],
  );

  console.log("Seeded starter products for storefront.");
};

const initDb = async () => {
  if (!dbConfig.database) {
    console.error("Database name is missing. Set MYSQLDATABASE in server/.env");
    return;
  }

  let connection;

  try {
    connection = await db.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await connection.query(
        "ALTER TABLE users ADD COLUMN role ENUM('admin', 'user') NOT NULL DEFAULT 'user'",
      );
    } catch (error) {
      if (error && error.code !== "ER_DUP_FIELDNAME") {
        throw error;
      }
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        image TEXT NOT NULL,
        description TEXT,
        stock INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('placed', 'paid', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'placed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT,
        product_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        price_at_purchase DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      )
    `);

    await ensureAdminUser(connection);
    await ensureDefaultProducts(connection);
    dbReady = true;
  } catch (error) {
    dbReady = false;
    console.error("Database connection/setup failed:");
    console.error(error);
  } finally {
    if (connection) connection.release();
  }
};

(async () => {
  await initDb();
})();

db.isReady = () => dbReady;

module.exports = db;
