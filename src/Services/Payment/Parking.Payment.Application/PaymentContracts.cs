namespace Parking.Payment.Application;

public sealed record CreatePaymentRequest(Guid BookingId, string Method);
public sealed record CashConfirmationRequest(int Version, string Reason);
public sealed record PaymentView(Guid Id, Guid LotId, Guid BookingId, long Amount, string Currency, string Method, string Status, int Version);
public interface IPaymentService
{
    Task<PaymentView> CreateAsync(Guid user,CreatePaymentRequest request,string key,CancellationToken ct);
    Task<PaymentView> ConfirmCashAsync(Guid actor,Guid lot,Guid payment,CashConfirmationRequest request,CancellationToken ct);
}
