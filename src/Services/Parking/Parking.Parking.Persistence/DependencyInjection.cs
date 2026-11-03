using Microsoft.Extensions.DependencyInjection;
using Parking.Parking.Application;
using Parking.Parking.Persistence.Repositories;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Parking.Parking.Persistence;

public static class DependencyInjection
{

    /// <summary>Đăng ký đồng hồ mặc định và Repository theo scope của request hoặc lượt chạy worker.</summary>
    public static IServiceCollection AddParkingPersistence(this IServiceCollection services)
    {

        services.TryAddSingleton<TimeProvider>(TimeProvider.System);
        services.AddScoped<IParkingRepository, ParkingRepository>();
        return services;
    }
}
