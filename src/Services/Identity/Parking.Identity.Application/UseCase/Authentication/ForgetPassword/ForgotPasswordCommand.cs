using MediatR;
using Parking.Identity.Application.Common.Enum;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.UseCase.Authentication.ForgetPassword
{
    public record ForgotPasswordCommand : IRequest<ForgotPasswordResult>
    {
        public string Email { get; init; } = string.Empty;
    }

    public sealed record ForgotPasswordResult(string Message);
}
