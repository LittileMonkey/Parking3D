using Parking.Identity.Application.Common.Behavior;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using FluentValidation;

namespace Parking.Identity.Application
{
    public static class ApplicationDependencyInjection
    {
        public static IServiceCollection AddApplicationDependencyInjection(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddMediatR(cfg => {

                // Đăng ký MediatR + Handler
                cfg.RegisterServicesFromAssembly(typeof(ApplicationDependencyInjection).Assembly);

                // Đăng ký ValidationBehavior
                cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));

                });

            services.AddValidatorsFromAssembly(typeof(ApplicationDependencyInjection).Assembly);

            return services;
        }
    }
}
