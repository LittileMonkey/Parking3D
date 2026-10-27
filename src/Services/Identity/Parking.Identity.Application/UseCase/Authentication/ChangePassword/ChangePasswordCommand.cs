using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.ChangePassword
{
    public record ChangePasswordCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public string? Password { get; init; }
        public string? NewPassword { get; init; }
        public string? ConfirmPassword { get; init; }
    }
}
