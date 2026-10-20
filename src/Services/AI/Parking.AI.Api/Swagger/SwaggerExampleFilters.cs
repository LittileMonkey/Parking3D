using System.Text.Json.Nodes;
using Microsoft.OpenApi;
using Parking.AI.Application.DTOs.Common;
using Parking.ServiceDefaults;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Parking.AI.Api.Swagger;

/// <summary>
/// Schema Filter tự động cung cấp ví dụ mẫu (OpenAPI Example) trực quan và có nghĩa cho các DTO phản hồi lỗi và chuẩn.
/// Giúp Swagger UI hiển thị thông tin lỗi chi tiết thay vì chuỗi mặc định generic như "string", 0, true.
/// </summary>
public class ApiResponseSchemaFilter : ISchemaFilter
{
    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema is not OpenApiSchema concreteSchema) return;

        // Xử lý các mẫu phản hồi lỗi chuẩn
        if (context.Type == typeof(ErrorResponse400))
        {
            concreteSchema.Description = "Mẫu phản hồi lỗi HTTP 400 - Dữ liệu yêu cầu không hợp lệ (Validation Error)";
            concreteSchema.Example = new JsonObject
            {
                ["result"] = null,
                ["isSuccess"] = false,
                ["statusCode"] = 400,
                ["message"] = "Dữ liệu yêu cầu không hợp lệ (Ví dụ: tham số bắt buộc để trống, định dạng ảnh không hỗ trợ, hoặc vượt quá kích thước cho phép 10MB)"
            };
            PopulateErrorProperties(concreteSchema, 400, "Dữ liệu yêu cầu không hợp lệ");
        }
        else if (context.Type == typeof(ErrorResponse401))
        {
            concreteSchema.Description = "Mẫu phản hồi lỗi HTTP 401 - Chưa xác thực tài khoản (Unauthorized)";
            concreteSchema.Example = new JsonObject
            {
                ["result"] = null,
                ["isSuccess"] = false,
                ["statusCode"] = 401,
                ["message"] = "Yêu cầu xác thực tài khoản. Vui lòng đính kèm Bearer JWT Token hợp lệ vào Authorization Header."
            };
            PopulateErrorProperties(concreteSchema, 401, "Yêu cầu xác thực tài khoản qua Bearer JWT Token.");
        }
        else if (context.Type == typeof(ErrorResponse403))
        {
            concreteSchema.Description = "Mẫu phản hồi lỗi HTTP 403 - Quyền hạn cơ sở bị từ chối (Facility Permission Denied)";
            concreteSchema.Example = new JsonObject
            {
                ["result"] = null,
                ["isSuccess"] = false,
                ["statusCode"] = 403,
                ["message"] = "Tài khoản không có quyền thao tác trên cơ sở bãi xe này. Yêu cầu quyền ADMIN hoặc OCR tương ứng."
            };
            PopulateErrorProperties(concreteSchema, 403, "Tài khoản không có quyền hạn trên cơ sở bãi xe này.");
        }
        else if (context.Type == typeof(ErrorResponse404))
        {
            concreteSchema.Description = "Mẫu phản hồi lỗi HTTP 404 - Không tìm thấy tài nguyên (Not Found)";
            concreteSchema.Example = new JsonObject
            {
                ["result"] = null,
                ["isSuccess"] = false,
                ["statusCode"] = 404,
                ["message"] = "Tài nguyên, bãi đỗ xe hoặc phiên hội thoại yêu cầu không tồn tại."
            };
            PopulateErrorProperties(concreteSchema, 404, "Không tìm thấy tài nguyên yêu cầu.");
        }
        else if (context.Type == typeof(ErrorResponse409))
        {
            concreteSchema.Description = "Mẫu phản hồi lỗi HTTP 409 - Xung đột phiên bản dữ liệu (Conflict / Concurrency Violation)";
            concreteSchema.Example = new JsonObject
            {
                ["result"] = null,
                ["isSuccess"] = false,
                ["statusCode"] = 409,
                ["message"] = "Xung đột phiên bản dữ liệu (Optimistic Lock Version Conflict) hoặc bản ghi đã được xử lý trước đó."
            };
            PopulateErrorProperties(concreteSchema, 409, "Xung đột phiên bản dữ liệu.");
        }
        else if (context.Type == typeof(ErrorResponse500))
        {
            concreteSchema.Description = "Mẫu phản hồi lỗi HTTP 500 - Lỗi máy chủ nội bộ hoặc gián đoạn kết nối CSDL (Internal Server Error)";
            concreteSchema.Example = new JsonObject
            {
                ["result"] = null,
                ["isSuccess"] = false,
                ["statusCode"] = 500,
                ["message"] = "Lỗi máy chủ nội bộ hoặc kết nối cơ sở dữ liệu PostgreSQL tạm thời gián đoạn."
            };
            PopulateErrorProperties(concreteSchema, 500, "Lỗi máy chủ nội bộ.");
        }
        else if (context.Type.IsGenericType && context.Type.GetGenericTypeDefinition() == typeof(ApiResponse<>))
        {
            concreteSchema.Description = "Cấu trúc phản hồi chuẩn hệ thống (Standard Envelope API Response)";
            if (concreteSchema.Properties != null)
            {
                if (concreteSchema.Properties.TryGetValue("isSuccess", out var isSuccessProp) && isSuccessProp is OpenApiSchema isSuccessSchema)
                {
                    isSuccessSchema.Example = true;
                    isSuccessSchema.Description = "Trạng thái xử lý thành công (true)";
                }
                if (concreteSchema.Properties.TryGetValue("statusCode", out var statusProp) && statusProp is OpenApiSchema statusSchema)
                {
                    statusSchema.Example = 200;
                    statusSchema.Description = "Mã trạng thái HTTP thành công (200)";
                }
                if (concreteSchema.Properties.TryGetValue("message", out var msgProp) && msgProp is OpenApiSchema msgSchema)
                {
                    msgSchema.Example = "Thao tác thành công.";
                    msgSchema.Description = "Thông điệp phản hồi từ máy chủ";
                }
            }
        }
    }

    private static void PopulateErrorProperties(OpenApiSchema schema, int statusCode, string defaultMessage)
    {
        if (schema.Properties == null) return;

        if (schema.Properties.TryGetValue("result", out var rProp) && rProp is OpenApiSchema rSchema)
        {
            rSchema.Description = "Dữ liệu trả về (luôn là null khi xảy ra lỗi)";
        }
        if (schema.Properties.TryGetValue("isSuccess", out var sProp) && sProp is OpenApiSchema sSchema)
        {
            sSchema.Example = false;
            sSchema.Description = "Trạng thái thành công (luôn là false khi lỗi)";
        }
        if (schema.Properties.TryGetValue("statusCode", out var scProp) && scProp is OpenApiSchema scSchema)
        {
            scSchema.Example = statusCode;
            scSchema.Description = $"Mã trạng thái HTTP ({statusCode})";
        }
        if (schema.Properties.TryGetValue("message", out var mProp) && mProp is OpenApiSchema mSchema)
        {
            mSchema.Example = defaultMessage;
            mSchema.Description = "Chi tiết nguyên nhân lỗi trả về cho client";
        }
    }
}

/// <summary>
/// Operation Filter thiết lập ví dụ mẫu chi tiết theo ngữ cảnh của từng endpoint cụ thể
/// Đảm bảo Swagger UI hiển thị chính xác nguyên nhân lỗi (file ảnh lỗi, prompt rỗng, session timeout, v.v.)
/// </summary>
public class ApiResponseOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var path = context.ApiDescription.RelativePath?.ToLowerInvariant() ?? string.Empty;

        // Cấu hình RequestBody cho endpoint quét biển số xe: hiển thị nút tải file ảnh "Choose File"
        if (path.Contains("license-plate/scan"))
        {
            operation.RequestBody = new OpenApiRequestBody
            {
                Description = "Tải file ảnh trực tiếp (.jpg, .png) hoặc gửi chuỗi JSON Base64",
                Required = true,
                Content = new Dictionary<string, OpenApiMediaType>
                {
                    ["multipart/form-data"] = new OpenApiMediaType
                    {
                        Schema = new OpenApiSchema
                        {
                            Type = JsonSchemaType.Object,
                            Properties = new Dictionary<string, IOpenApiSchema>
                            {
                                ["file"] = new OpenApiSchema
                                {
                                    Type = JsonSchemaType.String,
                                    Format = "binary",
                                    Description = "File ảnh chụp biển số xe (định dạng JPG hoặc PNG, tối đa 10MB)"
                                },
                                ["gateId"] = new OpenApiSchema
                                {
                                    Type = JsonSchemaType.String,
                                    Description = "Mã cổng quét biển số (Mặc định: GATE_IN_01)"
                                },
                                ["direction"] = new OpenApiSchema
                                {
                                    Type = JsonSchemaType.String,
                                    Description = "Hướng xe di chuyển (IN: Vào bãi, OUT: Ra bãi)"
                                },
                                ["parkingLotId"] = new OpenApiSchema
                                {
                                    Type = JsonSchemaType.String,
                                    Format = "uuid",
                                    Description = "Mã bãi đỗ xe (Parking Lot UUID - Tùy chọn)"
                                },
                                ["idempotencyKey"] = new OpenApiSchema
                                {
                                    Type = JsonSchemaType.String,
                                    Description = "Khóa chống trùng lặp request (Tùy chọn)"
                                }
                            },
                            Required = new HashSet<string> { "file" }
                        }
                    },
                    ["application/json"] = new OpenApiMediaType
                    {
                        Schema = context.SchemaGenerator.GenerateSchema(typeof(Parking.AI.Application.DTOs.LicensePlate.PlateRecognitionRequestDto), context.SchemaRepository)
                    }
                }
            };
        }

        if (operation.Responses == null) return;

        foreach (var (code, response) in operation.Responses)
        {
            if (response?.Content == null || !response.Content.TryGetValue("application/json", out var mediaType) || mediaType == null)
                continue;

            switch (code)
            {
                case "200":
                    response.Description = "Thao tác thực thi thành công (200 OK).";
                    break;
                case "400":
                    ApplyBadRequestExample(path, response, mediaType);
                    break;
                case "401":
                    response.Description = "Chưa xác thực tài khoản. Vui lòng gửi kèm Bearer JWT Token.";
                    SetMediaTypeExample(mediaType, CreateErrorJson(401, "Yêu cầu xác thực tài khoản. Vui lòng đính kèm Bearer JWT Token hợp lệ vào Authorization Header."));
                    break;
                case "403":
                    response.Description = "Không có quyền hạn thao tác trên cơ sở bãi xe này (Facility RBAC Violation).";
                    SetMediaTypeExample(mediaType, CreateErrorJson(403, "Tài khoản không có quyền thao tác trên cơ sở này (Facility Permission Denied). Yêu cầu quyền ADMIN hoặc OCR tương ứng."));
                    break;
                case "404":
                    ApplyNotFoundExample(path, response, mediaType);
                    break;
                case "409":
                    response.Description = "Xung đột phiên bản dữ liệu (Optimistic Concurrency Conflict) hoặc trạng thái không hợp lệ.";
                    SetMediaTypeExample(mediaType, CreateErrorJson(409, "Xung đột phiên bản dữ liệu (Optimistic Lock Version Conflict) hoặc bản ghi đã được xử lý trước đó."));
                    break;
                case "500":
                    response.Description = "Lỗi hệ thống nội bộ hoặc kết nối cơ sở dữ liệu PostgreSQL gián đoạn.";
                    SetMediaTypeExample(mediaType, CreateErrorJson(500, "Lỗi máy chủ nội bộ hoặc kết nối cơ sở dữ liệu PostgreSQL tạm thời gián đoạn."));
                    break;
            }
        }
    }

    private static void ApplyBadRequestExample(string path, IOpenApiResponse response, OpenApiMediaType mediaType)
    {
        if (path.Contains("license-plate/scan"))
        {
            response.Description = "Lỗi dữ liệu tải ảnh: Chưa đính kèm file, ảnh vượt quá 10MB, hoặc định dạng file không hợp lệ (không phải ảnh PNG/JPEG chuẩn qua Magic Bytes DEF-08).";
            SetMediaTypeExample(mediaType, CreateErrorJson(400, "Định dạng file không được hỗ trợ hoặc vượt quá 10MB. Chỉ chấp nhận ảnh PNG hoặc JPEG hợp lệ (Magic Bytes kiểm tra nghiêm ngặt)."));
        }
        else if (path.Contains("assistant/chat"))
        {
            response.Description = "Tin nhắn không hợp lệ: 'message' rỗng hoặc vượt quá 1000 ký tự.";
            SetMediaTypeExample(mediaType, CreateErrorJson(400, "Nội dung tin nhắn 'message' không được để trống hoặc vượt quá 1000 ký tự."));
        }
        else if (path.Contains("smart-search"))
        {
            response.Description = "Tham số tìm kiếm không hợp lệ: 'naturalLanguagePrompt' rỗng hoặc vượt quá 500 ký tự.";
            SetMediaTypeExample(mediaType, CreateErrorJson(400, "Nội dung tìm kiếm 'naturalLanguagePrompt' không được để trống hoặc vượt quá 500 ký tự."));
        }
        else if (path.Contains("documents") && path.Contains("publish"))
        {
            response.Description = "Bắt buộc xác nhận ConfirmPublicContentReviewed = true trước khi xuất bản tài liệu công khai.";
            SetMediaTypeExample(mediaType, CreateErrorJson(400, "Explicit public-content review confirmation required: Bắt buộc xác nhận kiểm duyệt nội dung trước khi xuất bản."));
        }
        else if (path.Contains("documents"))
        {
            response.Description = "Dữ liệu tài liệu tri thức không hợp lệ (tiêu đề, phân mục hoặc nội dung để trống).";
            SetMediaTypeExample(mediaType, CreateErrorJson(400, "Dữ liệu tài liệu không hợp lệ. 'title', 'section' hoặc 'content' không được để trống."));
        }
        else if (path.Contains("occupancy-forecasts"))
        {
            response.Description = "Tham số không hợp lệ: horizonMinutes không thuộc dải hỗ trợ (30, 60, 120 phút).";
            SetMediaTypeExample(mediaType, CreateErrorJson(400, "Tham số bãi xe 'lotId' không hợp lệ hoặc horizonMinutes không thuộc dải dự báo hỗ trợ (30, 60, 120 phút)."));
        }
        else if (path.Contains("assistant"))
        {
            response.Description = "Câu hỏi tra cứu FAQ không được để trống.";
            SetMediaTypeExample(mediaType, CreateErrorJson(400, "Câu hỏi tra cứu 'question' không được để trống hoặc vượt quá 500 ký tự."));
        }
        else
        {
            response.Description = "Tham số yêu cầu không hợp lệ hoặc thiếu thông tin bắt buộc.";
            SetMediaTypeExample(mediaType, CreateErrorJson(400, "Dữ liệu yêu cầu không hợp lệ. Vui lòng kiểm tra lại các trường thông tin đầu vào."));
        }
    }

    private static void ApplyNotFoundExample(string path, IOpenApiResponse response, OpenApiMediaType mediaType)
    {
        if (path.Contains("assistant/session"))
        {
            response.Description = "Phiên hội thoại không tồn tại hoặc đã hết hạn trong bộ nhớ đệm.";
            SetMediaTypeExample(mediaType, CreateErrorJson(404, "Phiên hội thoại không tồn tại hoặc đã hết hạn trong bộ nhớ đệm."));
        }
        else if (path.Contains("documents"))
        {
            response.Description = "Tài liệu tri thức yêu cầu không tồn tại.";
            SetMediaTypeExample(mediaType, CreateErrorJson(404, "Tài liệu tri thức yêu cầu không tồn tại trong hệ thống."));
        }
        else
        {
            response.Description = "Không tìm thấy tài nguyên hoặc bãi đỗ xe yêu cầu.";
            SetMediaTypeExample(mediaType, CreateErrorJson(404, "Không tìm thấy tài nguyên hoặc bãi đỗ xe yêu cầu."));
        }
    }

    private static void SetMediaTypeExample(OpenApiMediaType mediaType, JsonObject json)
    {
        mediaType.Example = json;
    }

    private static JsonObject CreateErrorJson(int statusCode, string message) => new()
    {
        ["result"] = null,
        ["isSuccess"] = false,
        ["statusCode"] = statusCode,
        ["message"] = message
    };
}
