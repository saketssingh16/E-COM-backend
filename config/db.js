const mysql = require("mysql2");

// 🔎 Debug what Railway is actually providing
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

// Test connection on startup
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:");
    console.error(err);
  } else {
    console.log("✅ Connected to Railway MySQL 🚀");
    connection.release();
  }
});

module.exports = db;
