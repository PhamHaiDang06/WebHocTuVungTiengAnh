/**
 * Wrapper loại bỏ try/catch lặp lại trong mọi controller.
 * Mọi lỗi async sẽ tự động được chuyển đến errorHandler middleware.
 *
 * @example
 * router.get('/me', asyncHandler(async (req, res) => {
 *   const user = await UserModel.findById(req.user.id);
 *   ApiResponse.success(res, user);
 * }));
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
