using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Persistence.DataAccessLayer;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Parking.Identity.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.Text;

using TokenValidationParameters = Microsoft.IdentityModel.Tokens.TokenValidationParameters;
using Parking.Identity.Persistence.Service;
using Parking.Identity.Persistence.Service.Google;

namespace Parking.Identity.Persistence
{
    public static class PersistenceDependencyInjection
    {
        public static IServiceCollection AddPersistenceDependencyInjection(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddDbContext<ParkingDatabaseV4Context>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnectionString")));

            services.AddScoped<IAccountRepository, AccountRepository>();
            services.AddScoped<IUnitOfWork, UnitOfWork>();
            services.AddScoped<IAccessTokenService, AccessTokenService>();
            services.AddScoped<IAuthTokenRepository, AuthTokenRepository>();
            services.AddScoped<IAssignedLotRepository, AssignedLotRepository>();

            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                            configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is required."))),

                        ValidateIssuer = true,
                        ValidIssuer = configuration["Jwt:Issuer"],

                        ValidateAudience = true,
                        ValidAudience = configuration["Jwt:Audience"],

                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.Zero

                    };
                });

            services.AddScoped<IGoogleSubjectLogin, GoogleSubjectLogin>();

            return services;
        }
    }
}
