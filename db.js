// backend/db.js
const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',       // Your MySQL username
  password: 'Bharath@30', // Your MySQL password
  database: 'faculty_pubs'         // Your database name
});

connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL');
});

module.exports = connection;
