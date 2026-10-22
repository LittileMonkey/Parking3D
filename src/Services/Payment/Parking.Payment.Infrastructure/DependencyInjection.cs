using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Parking.Payment.Application.Interfaces;
using Parking.Payment.Infrastructure.Configuration;
using Parking.Payment.Infrastructure.Repositories;
using Parking.Payment.Infrastructure.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Infrastructure
{
    public static class DependencyInjection
    {
        /// <summary>
        /// Nạp cấu hình VNPay và các Repository vào hệ thống.
        /// </summary>
        public static IServiceCollection AddInfrastructureServices (this IServiceCollection services, IConfiguration configuration)
        {
            // 1. Ánh xạ cấu hình VNPay từ appsettings.json vào VnPaySettings
            services.Configure<VnPaySettings>(configuration.GetSection("VNPay"));
            // 2. Đăng ký dịch vụ mã hóa VNPay
            services.AddScoped<IVnPayService, VnPayService>();
            // 3. Đăng ký Payment Repository
            services.AddScoped<IPaymentRepository, PaymentRepository>();

            return services;
        }
    }
}
