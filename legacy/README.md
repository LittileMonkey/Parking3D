# Legacy reference

`backend-template` là template MyStore/SQL Server từ main e8d71d8 trước khi chuyển kiến trúc. Không phải Parking API và không được chạy bởi solution/compose microservices mới.

Không dùng `AccountMember.MemberPassword` hoặc schema Product/Category cho Identity/Parking. Backend mới ở `src/Services`, solution `Parking.Microservices.slnx`. Lịch sử backend Parking cũ còn trong Git và nhánh backup; không nhập schema cũ vào database mới.
