using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Parking.Parking.Application.Behaviors;

namespace Parking.Parking.Application;

public static class DependencyInjection
{
    // Đăng ký handler/validator cùng assembly; validation chạy trước handler.
    /// <summary>Đăng ký MediatR, validators và pipeline để kiểm tra đầu vào trước khi gọi Handler.</summary>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;
        services.AddValidatorsFromAssembly(assembly);
        services.AddMediatR(configuration =>
        {
            configuration.RegisterServicesFromAssembly(assembly);
            configuration.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });
        return services;
    }
}
