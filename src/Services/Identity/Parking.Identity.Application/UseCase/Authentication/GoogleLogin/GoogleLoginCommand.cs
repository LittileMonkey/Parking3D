using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.UseCase.Authentication.GoogleLogin
{
    public sealed record GoogleLoginCommand : IRequest<GoogleLoginResult>
    {
        public string IdToken { get; init; } = string.Empty;
    }
}
