const mysql = require("mysql2/promise");

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

  return {
    host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
    user: process.env.MYSQLUSER || process.env.DB_USER || "root",
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || "",
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
  };
};

const dbConfig = getDbConfig();

console.log("---- ENVIRONMENT CHECK ----");
console.log("DB HOST:", dbConfig.host);
console.log("DB USER:", dbConfig.user);
console.log("DB NAME:", dbConfig.database || "(not set)");
console.log("DB PORT:", dbConfig.port);
console.log("----------------------------");

const useSsl =
  process.env.MYSQL_SSL === "true" ||
  process.env.NODE_ENV === "production" ||
  Boolean(connectionUrl);

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    dbReady = true;
    console.log("Connected to MySQL and verified users table");
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
