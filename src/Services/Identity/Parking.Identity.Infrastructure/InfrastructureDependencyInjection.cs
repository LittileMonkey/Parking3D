using Identity.Infrastructure.Service.PasswordHash;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Parking.Identity.Infrastructure.Initializer;
using Parking.Identity.Infrastructure.Service.Email;
using Parking.Identity.Infrastructure.Service.Google;
using Parking.Identity.Infrastructure.Service.Otp;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Identity.Infrastructure
{
    public static class InfrastructureDependencyInjection
    {
        public static IServiceCollection AddInfrastructureDependencyInjection(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddScoped<PasswordHasher<AppUser>>();
            services.AddScoped<IPasswordHasherService, PasswordHasherService>();
            services.AddScoped<DbInitializer>();
            services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();
            services.AddSingleton<IOtpService, OtpService>();
            services.AddScoped<IEmailService, EmailService>();
            return services;
        }
    }
}
