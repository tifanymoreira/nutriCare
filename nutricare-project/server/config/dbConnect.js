import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Carrega o .env a partir da pasta /server, independente de onde o `node` foi iniciado.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

async function db() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Database connected successfully!');
  } catch (error) {
    console.error('Error connecting to the database:', error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

export { pool, db };