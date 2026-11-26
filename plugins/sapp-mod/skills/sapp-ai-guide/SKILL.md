---
name: sapp-ai-guide
description: Hướng dẫn dùng Claude hiệu quả tại SAPP bằng 5 quy tắc ASK - CONTEXT - VERIFY - OUTPUT - TEST. Dùng khi người dùng hỏi cách dùng Claude cho tốt, cách viết yêu cầu (prompt) cho Claude, cách kiểm tra kết quả của Claude, hoặc hỏi quy tắc, hướng dẫn, nề nếp dùng Claude của SAPP. Use when someone asks how to use Claude well, how to write a good prompt, how to check Claude's answers, or what SAPP's rules for using Claude are.
---

# Dùng Claude hiệu quả – 5 quy tắc: ASK – CONTEXT – VERIFY – OUTPUT – TEST

Hướng dẫn chung cho mọi người dùng Claude tại SAPP, theo 5 nguyên tắc tối thiểu của buổi học "Làm việc hằng ngày với Claude Code". Mọi ví dụ dưới đây là ví dụ giả định, không phải dữ liệu thật.

Khi người dùng hỏi cách dùng Claude cho tốt, hãy trình bày đủ 5 quy tắc dưới đây bằng tiếng Việt, ngắn gọn, và gắn với việc cụ thể của họ nếu họ đã nói.

## 1. ASK – Hỏi bằng lời thường. Thiếu thì hỏi tiếp.

Nguyên tắc: Claude hiểu lời thường, nên không cần câu lệnh hoàn hảo. Hỏi như đang nhắn tin cho một đồng nghiệp; khi kết quả chưa đúng ý, nói thêm một câu ngay trong cùng cuộc trò chuyện.

- Nên: hỏi bằng lời của mình, rồi bổ sung: "Ý mình là theo tỷ lệ: số đơn huỷ trên tổng số đơn của từng kênh."
- Đừng: chờ viết được câu lệnh hoàn hảo mới hỏi, hay bỏ cuộc và làm lại từ đầu chỉ vì lần đầu chưa đúng ý.

## 2. CONTEXT – Cung cấp đủ thông tin: nói ra điều chỉ bạn biết

Nguyên tắc: quy ước của công ty và người nhận kết quả là phần bạn nói ra. "Doanh thu" có nhiều cách tính; không nói quy ước thì con số đổi theo từng lần chạy, và Claude không sai khi chọn một cách hợp lý.

- Nên: "Doanh thu tính theo ngày thu tiền trong tháng 10, đơn huỷ không tính. Báo cáo là một file có bảng, để gửi trưởng phòng."
- Đừng: để Claude tự đoán cách tính hay người nhận là ai.

## 3. VERIFY – Đọc xem Claude đã tính gì, bỏ gì, rồi mới gửi đi

Nguyên tắc: Claude thường tự thấy chỗ lạ (số tiền lạ, dòng trùng, ô trống, ngày ngoài kỳ), nói rõ và hỏi lại bạn. Tính hay không tính một dòng lạ là bạn quyết, vì chỉ bạn kiểm được chứng từ.

- Nên: đọc phần Claude báo lại, rồi trả lời: "Mình kiểm chứng từ rồi: phiếu này gõ thừa một số 0, số đúng là 7.490.000; phiếu kia nhập hai lần, chỉ tính một lần."
- Đừng: chỉ chép con số cuối rồi gửi đi, bỏ qua câu Claude hỏi.

## 4. OUTPUT – Nói rõ xong khi nào: cần ra cái gì, cho ai, trông ra sao

Nguyên tắc: OUTPUT mô tả sản phẩm cần ra; nói trước khi nhờ làm. Khác với TEST: TEST là các phép kiểm Claude chạy trên sản phẩm đó.

- Nên: "Xếp theo doanh thu từ cao xuống thấp, thêm cột số đơn và cột tỷ lệ % trên tổng doanh thu, làm tròn nghìn đồng. Không đổi phần nào khác của báo cáo."
- Đừng: chỉ nhờ "thêm một bảng theo khoá học": Claude làm một bảng hợp lý nhưng chưa biết thế nào là xong.

## 5. TEST – Đưa cách kiểm: để Claude tự kiểm theo tiêu chí của bạn trước khi báo xong

Nguyên tắc: đưa cho Claude một con số bạn chắc chắn (ví dụ kết quả tháng trước đã được duyệt) để nó tự kiểm trước khi báo xong. Với code, phép kiểm như vậy chính là test hồi quy.

- Nên: "Trước khi báo xong, tự kiểm: cùng cách tính đó áp cho dữ liệu tháng trước phải ra đúng con số đã duyệt."
- Đừng: nhận báo cáo hay script người khác để lại rồi dùng lại mà không có phép kiểm nào; lỗi có sẵn trong đó sẽ đi tiếp mà không ai thấy.

## Trước khi cho phép Claude làm việc đi ra ngoài máy

- Đọc kỹ trước khi cho phép. Khi Claude xin gửi, xoá hay đăng gì lên, đọc xem nó gửi gì và gửi đi đâu rồi mới đồng ý.
- Không đưa cho Claude thông tin cá nhân, mật khẩu hay hợp đồng mật.
- Cần thêm công cụ thì hỏi người phụ trách, không tự cài.
- Gửi đúng file, không gửi cả thư mục: thư mục còn có sổ ghi chú và các bản cũ.

## Nhớ nhanh

ASK: hỏi bằng lời thường, thiếu thì hỏi tiếp. CONTEXT: nói ra điều chỉ bạn biết. VERIFY: đọc Claude đã tính gì, bỏ gì rồi mới gửi. OUTPUT: nói rõ xong khi nào. TEST: đưa cách kiểm trước khi báo xong.
