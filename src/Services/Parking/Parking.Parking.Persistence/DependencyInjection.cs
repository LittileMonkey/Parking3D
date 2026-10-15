using Microsoft.Extensions.DependencyInjection;
using Parking.Parking.Application;
using Parking.Parking.Persistence.Repositories;

namespace Parking.Parking.Persistence;

public static class DependencyInjection
{
    public static IServiceCollection AddParkingPersistence(this IServiceCollection services)
    {
        services.AddScoped<IParkingRepository, ParkingRepository>();
        return services;
    }
}
