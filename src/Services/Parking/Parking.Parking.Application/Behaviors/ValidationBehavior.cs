using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;

namespace Parking.Parking.Application.Behaviors
{
    public class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
        where TRequest : IRequest<TResponse>
    {
        private readonly IEnumerable<IValidator<TRequest>> _validators;
        // Tự động gom tất cả các file Validator trong dự án vào đây
        public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
        {
            _validators = validators;
        }
        // Hàm này sẽ tự động kích hoạt trước khi chạy vào Handler (Logic chính) của bạn
        public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        {
            if (_validators.Any())
            {
                var context = new ValidationContext<TRequest>(request);
                // Chạy tất cả các luồng kiểm tra (Validate)
                var validationResults = await Task.WhenAll(
                    _validators.Select(v => v.ValidateAsync(context, cancellationToken)));
                // Gom tất cả các lỗi lại (nếu có)
                var failures = validationResults
                    .SelectMany(r => r.Errors)
                    .Where(f => f != null)
                    .ToList();
                // Nếu có ít nhất 1 lỗi -> Quăng Exception ngay lập tức, chặn không cho chạy tiếp!
                if (failures.Count != 0)
                {
                    throw new ValidationException(failures);
                }
            }
            // Nếu không có lỗi gì, cho phép request chạy tiếp vào Handler của bạn
            return await next();
        }
    }
}
