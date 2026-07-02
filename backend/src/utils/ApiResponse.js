export class ApiResponse {
  static success(res, data = null, message = 'Thành công', statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, data });
  }
  static created(res, data = null, message = 'Tạo thành công') {
    return this.success(res, data, message, 201);
  }
  static error(res, message = 'Lỗi server', statusCode = 500, errors = null) {
    return res.status(statusCode).json({ success: false, message, ...(errors && { errors }) });
  }
}
