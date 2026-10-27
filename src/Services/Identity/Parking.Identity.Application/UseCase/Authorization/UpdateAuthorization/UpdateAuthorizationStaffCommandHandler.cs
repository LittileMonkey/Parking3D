using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.UseCase.Authorization.UpdateAuthorization
{
    public class UpdateAuthorizationStaffCommandHandler
        : IRequestHandler<UpdateAuthorizationStaffCommand, AppUserDto>
    {
        private readonly IAccountRepository accountRepository;
        private readonly IUnitOfWork unitOfWork;

        public UpdateAuthorizationStaffCommandHandler(
            IAccountRepository repository,
            IUnitOfWork unit)
        {
            this.accountRepository = repository;
            this.unitOfWork = unit;
        }

        public async Task<AppUserDto> Handle(UpdateAuthorizationStaffCommand request, CancellationToken cancellationToken)
        {
            // 1. Tìm tài khoản cần thay đổi role
            var user = await accountRepository.GetUserByIdAsync(request.userId, cancellationToken);

            if (user == null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "The requested account could not be found.");
            }

            // 2. Kiểm tra role mới
            if (string.IsNullOrWhiteSpace(request.RoleCode))
            {
                throw new AppException(ErrorCode.RequiredFieldMissing, "RoleCode is required.");
            }

            var newRole = request.RoleCode.Trim().ToUpperInvariant();

            if (newRole != AppUserRoles.Customer && newRole != AppUserRoles.Manager && newRole != AppUserRoles.Staff)
            {
                throw new AppException(ErrorCode.InvalidRequest, "The specified role is invalid.");
            }

            // 3. Không cho thay đổi tài khoản ADMIN
            var isAdmin = user.PlatformUserRoles
                .Any(x => x.RoleCode == AppUserRoles.Admin);

            if (isAdmin)
            {
                throw new AppException(ErrorCode.Forbidden, "Cannot modify system administrator role.");
            }

            // 4. Kiểm tra tài khoản đã có role mới chưa
            var roleAlreadyExist = user.PlatformUserRoles
                .Any(x => x.RoleCode == newRole);

            if (roleAlreadyExist)
            {
                throw new AppException(ErrorCode.InvalidRequest, "The account already has this role assigned.");
            }

            // 5. Xóa role hiện tại
            user.PlatformUserRoles.Clear();

            // 6. Thêm role mới
            var role = new PlatformUserRole()
            {
                UserId = user.Id,
                RoleCode = newRole
            };

            user.PlatformUserRoles.Add(role);

            // 7. Lưu database
            await accountRepository.UpdateAccount(user);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            // 8. Trả về thông tin tài khoản
            return new AppUserDto
            {
                Id = user.Id,
                EmailNormalized = user.EmailNormalized,
                Roles = user.PlatformUserRoles
                    .Select(x => x.RoleCode)
                    .ToList()
            };
        }
    }
}