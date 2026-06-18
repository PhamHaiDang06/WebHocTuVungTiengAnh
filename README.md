Markdown
## Tài liệu API - Quản lý Từ vựng (Words)
Phụ trách bởi: [Phạm Hải Đăng]

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

##Tài liệu quản lí Vocabulary
Phụ trách bởi Nguyễn Hoàng Việt Bách

Module này để quản lí danh sách vocabulary(lấy danh sách,thêm chi tiết từ vựng,thêm,cập nhật,xóa từ vựng)trong cơ sở dữ liệu'vocabmaster'.

### Bảng API Endpoints - Vocabulary

| HTTP Method | Endpoint              | Phân quyền | Mô tả                    | Chi tiết / Tham số                                                                         |
| :---------- | :-------------------- | :--------- | :----------------------- | :----------------------------------------------------------------------------------------- |
| **GET**     | `/api/vocabulary`     | Public     | Lấy danh sách từ vựng    | Hỗ trợ query: `?page=1&limit=10&search=apple`                                              |
| **GET**     | `/api/vocabulary/:id` | Public     | Lấy chi tiết một từ vựng | Trả về thông tin từ, nghĩa, ví dụ, chủ đề                                                  |
| **POST**    | `/api/vocabulary`     | Admin      | Thêm từ vựng mới         | `{ "word": "Apple", "meaning": "Quả táo", "example": "I eat an apple", "topic_id": 1 }`    |
| **PUT**     | `/api/vocabulary/:id` | Admin      | Cập nhật từ vựng         | `{ "word": "Apple", "meaning": "Trái táo", "example": "She likes apples", "topic_id": 1 }` |
| **DELETE**  | `/api/vocabulary/:id` | Admin      | Xóa từ vựng              | Xóa từ vựng theo ID                                                                        |

