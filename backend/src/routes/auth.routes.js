import { Router } from 'express';
import { body } from 'express-validator';
import * as AuthController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// ─── Validation Rules ─────────────────────────────────────────────────────────
const registerRules = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username phải từ 3 đến 30 ký tự')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username chỉ được chứa chữ cái, số và dấu gạch dưới'),

  body('email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 }).withMessage('Mật khẩu tối thiểu 8 ký tự')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa ít nhất một chữ cái và một chữ số'),
];

const loginRules = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────
// authLimiter áp dụng riêng cho register & login (10 req/15 phút)
router.post('/register', authLimiter, registerRules, AuthController.register);
router.post('/login',    authLimiter, loginRules,    AuthController.login);
router.post('/refresh',  AuthController.refresh);   // Không cần auth (đây là endpoint lấy lại token)
router.post('/logout',   AuthController.logout);
router.get('/me',        authenticate, AuthController.me);

export default router;
