using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.Common.Interfaces;
using ParkingSystem.Application.Common.Models;
using ParkingSystem.Application.Features.LicensePlate.DTOs;

namespace ParkingSystem.Presentation.WebApi.Controllers;

[ApiController]
[Route("api/v1/ai/license-plate")]
public class LicensePlateController(ILicensePlateRecognitionService recognitionService) : ControllerBase
{
    /// <summary>
    /// Nhận diện biển số xe từ ảnh chụp camera (Hỗ trợ cả tải file trực tiếp hoặc chuỗi Base64)
    /// </summary>
    /// <param name="file">File ảnh từ camera chụp cổng</param>
    /// <param name="request">Dữ liệu dạng JSON chứa Base64 (nếu không dùng form-data)</param>
    /// <param name="gateId">Mã định danh cổng quét (mặc định GATE_IN_01)</param>
    /// <param name="direction">Chiều xe chạy: IN hoặc OUT</param>
    /// <param name="parkingLotId">Mã bãi đỗ xe</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Kết quả biển số đã chuẩn hóa và độ tin cậy</returns>
    [HttpPost("scan")]
    [Consumes("multipart/form-data", "application/json")]
    [ProducesResponseType(typeof(ApiResponse<PlateRecognitionResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<PlateRecognitionResultDto>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ScanPlate(
        [FromForm] IFormFile? file,
        [FromForm] string? gateId,
        [FromForm] string? direction,
        [FromForm] Guid? parkingLotId,
        [FromBody] PlateRecognitionRequestDto? request,
        CancellationToken ct)
    {
        PlateRecognitionResultDto result;

        // Trường hợp 1: Tải file qua Form Data
        if (file != null && file.Length > 0)
        {
            if (file.Length > 10 * 1024 * 1024) // Giới hạn 10MB
            {
                return BadRequest(ApiResponse<PlateRecognitionResultDto>.Failure(
                    "Dung lượng file ảnh vượt quá giới hạn 10MB.", 400));
            }

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream, ct);
            var bytes = memoryStream.ToArray();

            result = await recognitionService.RecognizePlateFromBytesAsync(
                bytes,
                gateId ?? "GATE_IN_01",
                direction ?? "IN",
                parkingLotId,
                ct);
        }
        // Trường hợp 2: Gửi JSON kèm Base64
        else if (request != null && !string.IsNullOrWhiteSpace(request.ImageBase64))
        {
            result = await recognitionService.RecognizePlateAsync(request, ct);
        }
        else
        {
            return BadRequest(ApiResponse<PlateRecognitionResultDto>.Failure(
                "Yêu cầu phải có file ảnh tải lên hoặc chuỗi Base64 'imageBase64'.", 400));
        }

        return Ok(ApiResponse<PlateRecognitionResultDto>.Success(
            result, "Nhận diện biển số xe thành công.", 200));
    }
}
