const mysql = require("mysql2/promise");

// Optional debug (you can remove later)
console.log("---- ENVIRONMENT CHECK ----");
console.log("MYSQLHOST:", process.env.MYSQLHOST);
console.log("MYSQLUSER:", process.env.MYSQLUSER);
console.log("MYSQLDATABASE:", process.env.MYSQLDATABASE);
console.log("MYSQLPORT:", process.env.MYSQLPORT);
console.log("----------------------------");

const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test connection
(async () => {
  try {
    const connection = await db.getConnection();
    console.log("✅ Connected to Railway MySQL 🚀");
    connection.release();
  } catch (err) {
    console.error("❌ Database connection failed:");
    console.error(err);
  }
})();

module.exports = db;
