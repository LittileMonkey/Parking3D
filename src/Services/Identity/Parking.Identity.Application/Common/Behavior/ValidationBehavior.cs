using FluentValidation;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Behavior
{
    public class ValidationBehavior<IRequest, IResponse> : IPipelineBehavior<IRequest, IResponse> where IRequest : IRequest<IResponse>
    {
        private readonly IEnumerable<IValidator<IRequest>> validators;

        public ValidationBehavior(IEnumerable<IValidator<IRequest>> _validators)
        {
            this.validators = _validators;
        }
        public async Task<IResponse> Handle(IRequest request, RequestHandlerDelegate<IResponse> next, CancellationToken cancellationToken)
        {
            if (validators.Any())
            {
                var context = new ValidationContext<IRequest>(request);

                var validateResult = await Task.WhenAll(validators.Select(x => x.ValidateAsync(context, cancellationToken)));

                var errors = validateResult
                    .SelectMany(x => x.Errors)
                    .Where(x => x != null!)
                    .ToList();

                if(errors.Count != 0)
                {
                    throw new ValidationException(errors);
                }
            }

            return await next();
        }
    }
}
