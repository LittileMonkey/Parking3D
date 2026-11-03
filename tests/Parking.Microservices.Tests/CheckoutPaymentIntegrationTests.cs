using System.Net;
using System.Security.Cryptography;
using System.Text;
using Google.Protobuf;
using Grpc.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Npgsql;
using Parking.Contracts.Checkout.V1;
using Parking.Contracts.Identity.V1;
using Parking.Identity.Persistence.Repositories;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Infrastructure;
using Parking.Parking.Infrastructure.Services;
using Parking.Payment.Infrastructure;
using Parking.Payment.Infrastructure.Configuration;
using Parking.Payment.Infrastructure.Services;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed partial class ParkingWorkflowTests
{
    [PostgresFact]
    public async Task CheckoutCashIsRecordedOnceAndPhysicalExitStillRequiresConfirmation()
    {
        await WithCheckoutPayment(async(service,payments,proof,request)=>
        {
            var settle=SettlementRequest(request,"CASH");settle.CashReceived=(long)proof.GrossAmount;
            var first=await service.SettleAsync(settle,Ct);
            Assert.True(Guid.TryParse(first.PaymentId,out _));
            Assert.Equal((long)proof.GrossAmount,first.AmountPaid);
            Assert.Equal(first.PaymentId,(await service.SettleAsync(settle,Ct)).PaymentId);
            Assert.Equal(1L,await PaymentScalar(payments,"SELECT count(*) FROM payments"));
            Assert.Equal(1L,await PaymentScalar(payments,"SELECT count(*) FROM integration_outbox"));
            Assert.Equal(1L,await PaymentScalar(payments,"SELECT count(*) FROM billing_lines"));
            await AssertCheckOutNotWritten();
            var evidence=new CheckOutPaymentEvidence(Guid.Parse(first.PaymentId),proof.SessionId,Lot,first.AmountPaid,"VND","CASH");
            var result=await repository.CompleteCheckOutAsync(Staff,request with {PaymentMethod="CASH",CashReceived=proof.GrossAmount},"paid-exit",Ct,new(proof,evidence));
            Assert.Equal("AVAILABLE",result.SlotStatus);
            Assert.Equal("STAFF_CONFIRMED_EXIT",result.BarrierStatus);
            Assert.Equal(first.AmountPaid,result.FinalAmountPaid);
        });
    }

    [PostgresFact]
    public async Task CheckoutInsufficientCashAndFakeVnPayDoNotCreatePayments()
    {
        await WithCheckoutPayment(async(service,payments,proof,request)=>
        {
            var cash=SettlementRequest(request,"CASH");cash.CashReceived=(long)proof.GrossAmount-1;
            Assert.Equal(409,(await Assert.ThrowsAsync<ServiceException>(()=>service.SettleAsync(cash,Ct))).StatusCode);
            var fake=SettlementRequest(request,"VNPAY_QR");fake.PaymentReference=Guid.NewGuid().ToString();
            Assert.Equal(409,(await Assert.ThrowsAsync<ServiceException>(()=>service.SettleAsync(fake,Ct))).StatusCode);
            Assert.Equal(0L,await PaymentScalar(payments,"SELECT count(*) FROM payments"));
            await AssertCheckOutNotWritten();
        });
    }

    [PostgresFact]
    public async Task CheckoutConcurrentCashRequestsHaveOneLedgerEffect()
    {
        await WithCheckoutPayment(async(service,payments,proof,request)=>
        {
            var settle=SettlementRequest(request,"CASH");settle.CashReceived=(long)proof.GrossAmount;
            var results=await Task.WhenAll(Enumerable.Range(0,8).Select(_=>service.SettleAsync(settle,Ct)));
            Assert.All(results,result=>Assert.Equal(results[0].PaymentId,result.PaymentId));
            Assert.Equal(1L,await PaymentScalar(payments,"SELECT count(*) FROM payments"));
            Assert.Equal(1L,await PaymentScalar(payments,"SELECT count(*) FROM audit_logs WHERE action='CHECKOUT_CASH_COLLECTED'"));
            await AssertCheckOutNotWritten();
        });
    }

    [PostgresFact]
    public async Task CheckoutVnPayRequiresSignedExactAmountSuccessfulIpnAndIsIdempotent()
    {
        await WithCheckoutPayment(async(service,payments,proof,request)=>
        {
            var pending=await service.PrepareVnPayAsync(Staff,request.QuoteToken,"127.0.0.1",Ct);
            var retry=await service.PrepareVnPayAsync(Staff,request.QuoteToken,"127.0.0.1",Ct);
            Assert.Equal(pending.PaymentId,retry.PaymentId);
            var settle=SettlementRequest(request,"VNPAY_QR");settle.PaymentReference=pending.PaymentId.ToString();
            Assert.Equal(409,(await Assert.ThrowsAsync<ServiceException>(()=>service.SettleAsync(settle,Ct))).StatusCode);
            var cash=SettlementRequest(request,"CASH");cash.CashReceived=(long)proof.GrossAmount;
            Assert.Equal(409,(await Assert.ThrowsAsync<ServiceException>(()=>service.SettleAsync(cash,Ct))).StatusCode);
            var txn=(string)(await PaymentScalar(payments,"SELECT merchant_reference FROM payment_attempts"))!;
            var query=SignedIpn(txn,(long)proof.GrossAmount);
            query["vnp_SecureHash"]="invalid";
            Assert.Equal("97",(await service.HandleIpnAsync(query,Ct)).RspCode);
            query=SignedIpn(txn,(long)proof.GrossAmount+1);
            Assert.Equal("04",(await service.HandleIpnAsync(query,Ct)).RspCode);
            Assert.Equal("PENDING",await PaymentScalar(payments,"SELECT status::text FROM payments"));
            query=SignedIpn(txn,(long)proof.GrossAmount);
            Assert.Equal("00",(await service.HandleIpnAsync(query,Ct)).RspCode);
            Assert.Equal("02",(await service.HandleIpnAsync(query,Ct)).RspCode);
            Assert.Equal(1L,await PaymentScalar(payments,"SELECT count(*) FROM integration_outbox"));
            Assert.Equal((long)proof.GrossAmount,(await service.SettleAsync(settle,Ct)).AmountPaid);
            // Payment callbacks record evidence, never mark the physical session as exited.
            await using var eventRead=payments.CreateCommand("SELECT payload::text FROM integration_outbox");
            var message=JsonParser.Default.Parse<CheckoutPaymentSucceeded>((string)(await eventRead.ExecuteScalarAsync())!);
            var receiver=new ParkingCheckoutEventsGrpc(data);
            Assert.Equal("RECORDED",(await receiver.Deliver(message,new CallContext())).Outcome);
            Assert.Equal("RECORDED",(await receiver.Deliver(message,new CallContext())).Outcome);
            Assert.Equal(1L,await Scalar("SELECT count(*) FROM audit_logs WHERE action='CHECKOUT_PAYMENT_RECEIVED'"));
            await AssertCheckOutNotWritten();
        });
    }

    private async Task WithCheckoutPayment(Func<CheckoutPaymentService,NpgsqlDataSource,CheckOutProof,ConfirmCheckOutRequestDto,Task> action)
    {
        var request=await PrepareAuthorizedCheckOut();
        var clock=UseHoldTestClock();clock.UtcNow=DateTimeOffset.UtcNow.AddHours(2);
        var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>
            {["Qr:SigningKey"]=new string('x',64),["Grpc:ServiceKey"]=new string('t',64),
             ["VNPay:HashSecret"]=new string('v',64),["VNPay:TmnCode"]="TEST",["VNPay:BaseUrl"]="https://sandbox.example.test/pay"}).Build();
        var tokens=new CheckOutTokens(config,clock);
        var quote=await repository.GetCheckOutQuoteAsync(Lot,request.GateId,"51A12345",null,Ct,request.SessionId);
        var proof=new CheckOutProof(Guid.NewGuid(),Staff,request.SessionId,Lot,request.GateId,quote.SlotId,quote.VehicleId,
            quote.PricingSnapshotId,quote.ExitPlate,quote.QuoteAt,quote.QuoteAt.AddMinutes(5),quote.TotalAmountDue);
        Assert.True(proof.GrossAmount>0);
        request=request with {QuoteToken=tokens.SignQuote(proof),StaffNotes="Test: cash collected and physical exit observed"};
        await using var identity=CheckOutIdentityContext();
        var assignments=new AssignedLotRepository(identity);
        var query=new ParkingCheckoutQueryGrpc(tokens,repository,new CheckOutIdentityAccess(assignments),data);
        var name="checkout_pay_it_"+Guid.NewGuid().ToString("N");
        await using var admin=new NpgsqlConnection(adminConnection);await admin.OpenAsync();
        await new NpgsqlCommand($"CREATE DATABASE \"{name}\"",admin).ExecuteNonQueryAsync();
        try
        {
            var builder=new NpgsqlConnectionStringBuilder(adminConnection){Database=name};
            await using var payments=NpgsqlDataSource.Create(builder.ConnectionString);
            await using(var schema=payments.CreateCommand(await File.ReadAllTextAsync(Path.Combine(FindRoot(),"database/services/payment/001_schema.sql"))))
                await schema.ExecuteNonQueryAsync();
            var vnPay=new VnPayService(Options.Create(new VnPaySettings{HashSecret=new string('v',64),TmnCode="TEST",
                BaseUrl="https://sandbox.example.test/pay",ReturnUrl="http://localhost/return"}));
            // Each real Identity request has its own scope. Serialize this shared-context test adapter only.
            using var identityGate=new SemaphoreSlim(1,1);
            var service=new CheckoutPaymentService(payments,new CheckoutQueryStub(query,identityGate),new CheckoutIdentityStub(assignments,identityGate),config,vnPay);
            await action(service,payments,proof,request);
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await new NpgsqlCommand($"DROP DATABASE \"{name}\" WITH (FORCE)",admin).ExecuteNonQueryAsync();
        }
    }

    private static CheckoutSettleRequest SettlementRequest(ConfirmCheckOutRequestDto request,string method)
        =>new(){ActorId=Staff.ToString(),QuoteToken=request.QuoteToken,Method=method,StaffNotes="Test settlement"};
    private static async Task<object?> PaymentScalar(NpgsqlDataSource data,string sql)
    {await using var command=data.CreateCommand(sql);return await command.ExecuteScalarAsync();}
    private static Dictionary<string,string> SignedIpn(string reference,long amount)
    {
        var query=new Dictionary<string,string>{{"vnp_TmnCode","TEST"},{"vnp_TxnRef",reference},{"vnp_Amount",(amount*100).ToString()},
            {"vnp_ResponseCode","00"},{"vnp_TransactionStatus","00"},{"vnp_TransactionNo","test-provider-transaction"}};
        var raw=string.Join("&",query.OrderBy(pair=>pair.Key,StringComparer.Ordinal).Select(pair=>WebUtility.UrlEncode(pair.Key)+"="+WebUtility.UrlEncode(pair.Value)));
        query["vnp_SecureHash"]=Convert.ToHexStringLower(HMACSHA512.HashData(Encoding.UTF8.GetBytes(new string('v',64)),Encoding.UTF8.GetBytes(raw)));
        return query;
    }
    private sealed class CheckoutQueryStub(ParkingCheckoutQueryGrpc query,SemaphoreSlim gate):ParkingCheckoutQuery.ParkingCheckoutQueryClient
    {
        public override AsyncUnaryCall<CheckoutBill> ValidateQuoteAsync(CheckoutQuoteRequest request,CallOptions options)
            =>new(Validate(request),Task.FromResult(new Metadata()),()=>Status.DefaultSuccess,()=>new Metadata(),()=>{});
        private async Task<CheckoutBill> Validate(CheckoutQuoteRequest request)
        {await gate.WaitAsync();try{return await query.ValidateQuote(request,new CallContext());}finally{gate.Release();}}
    }
    private sealed class CheckoutIdentityStub(AssignedLotRepository assignments,SemaphoreSlim gate):FacilityAuthorization.FacilityAuthorizationClient
    {
        public override AsyncUnaryCall<AccessReply> CheckAccessAsync(AccessRequest request,CallOptions options)
            =>new(Check(request),Task.FromResult(new Metadata()),()=>Status.DefaultSuccess,()=>new Metadata(),()=>{});
        private async Task<AccessReply> Check(AccessRequest request)
        {await gate.WaitAsync();try{return new(){Allowed=await assignments.CheckAccessAsync(Guid.Parse(request.UserId),Guid.Parse(request.LotId),request.Capability,CancellationToken.None)};}finally{gate.Release();}}
    }
}
