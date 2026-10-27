using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IPasswordResetOtpRepository
    {
        //vô hiệu hóa các OTP cũ chưa dùng.
        Task InvalidateActiveOtpsAsync(Guid userId, CancellationToken cancellationToken);

        //thêm một yêu cầu OTP mới.
        Task AddNewOtpAsync(PasswordResetOtp otp, CancellationToken cancellationToken);

        //lấy OTP mới nhất chưa sử dụng để xác minh.
        Task<PasswordResetOtp?> GetLatestUnusedOtpAsync(Guid userId, CancellationToken cancellationToken);
    }
}
