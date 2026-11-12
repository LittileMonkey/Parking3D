using Microsoft.Extensions.DependencyInjection;
using Parking.Payment.Application.Interfaces;
using Parking.Payment.Infrastructure.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructureServices (this IServiceCollection services)
        {
            services.AddScoped<IPaymentRepository, PaymentRepository>();
            return services;
        }
    }
}
