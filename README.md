Markdown
## Tài liệu API - Quản lý Từ vựng (Words)
Phụ trách bởi: [Tên của bạn]

Module này chịu trách nhiệm quản lý hệ thống từ vựng (duyệt, tìm kiếm, lấy dữ liệu từ API từ điển bên ngoài, và thêm vào danh sách học của người dùng) trong cơ sở dữ liệu `vocabmaster`.

### Bảng API Endpoints
| HTTP Method | Endpoint | Phân quyền | Mô tả | Chi tiết / Tham số |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/words` | Public | Lấy danh sách & tìm kiếm từ vựng | Hỗ trợ query: `?page=1&limit=20&search=...` |
| **GET** | `/api/words/:id` | Public | Lấy chi tiết một từ | Trả về thông tin đầy đủ của từ (nguồn gốc, định nghĩa) |
| **POST** | `/api/words/seed/:word` | Auth | Fetch từ điển API & lưu vào DB | Seed tự động nếu chưa có trong DB |
| **POST** | `/api/words/:id/deck` | Auth | Thêm từ vào danh sách học | Tạo progress SM-2 cho user hiện tại |
| **POST** | `/api/words` | Admin | Tạo từ vựng mới thủ công | `{ "word": "example", "difficulty": "intermediate" }` |
| **PUT** | `/api/words/:id` | Admin | Cập nhật thông tin từ vựng | `{ "cefrLevel": "B2", "isPublished": true }` |
| **DELETE** | `/api/words/:id` | Admin | Ẩn từ vựng (Soft-delete) | Chuyển trạng thái `isPublished = false` |
