import mysql from 'mysql2/promise';
import { env } from './env.js';

/**
 * MySQL connection pool — dùng chung toàn app, không tạo connection mới mỗi request.
 * Aiven yêu cầu SSL ở mọi môi trường.
 */
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,

  // Aiven bắt buộc SSL — rejectUnauthorized: false khi dùng self-signed cert
  ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,

  waitForConnections: true,
  connectionLimit: 10,   // Max 10 connections đồng thời
  queueLimit: 0,         // 0 = không giới hạn hàng đợi
  timezone: '+00:00',    // Luôn lưu UTC
  charset: 'utf8mb4',
});

/**
 * Kiểm tra kết nối khi khởi động server.
 * Nếu lỗi → process.exit(1) để tránh chạy app khi không có DB.
 */
export const testConnection = async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.ping();
    console.log(`✅ MySQL connected → ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  } finally {
    conn?.release();
  }
};
