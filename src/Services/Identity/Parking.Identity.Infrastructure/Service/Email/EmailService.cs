
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;
using Parking.Identity.Application.Common.Interface;

namespace Parking.Identity.Infrastructure.Service.Email
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration configuration;
        public EmailService(IConfiguration configuration)
        {
            this.configuration = configuration;
        }
        public async Task SendPasswordResetOtpAsync(string email, string otp, CancellationToken cancellationToken)
        {
            var Email = configuration.GetSection("Email");

            var Sender = Email["Sender"] ?? throw new InvalidOperationException("Email:Sender is missing.");

            var AppPassword = Email["AppPassword"] ?? throw new InvalidOperationException("Email:AppPassword is missing.");

            var message = new MimeMessage();

            message.From.Add(MailboxAddress.Parse(Sender));
            message.To.Add(MailboxAddress.Parse(email));
            message.Subject = "Parking - Reset Password";

            message.Body = new TextPart("plain")
            {
                   Text = $"""
                          PARKINGLOTS SYSTEM
                          PASSWORD RESET VERIFICATION
                          Hello,

                          We received a request to reset the password for your ParkingLots System account.

                          Your password reset OTP is: {otp}

                          This OTP is valid for 5 minutes. For your security, do not share this code with anyone.

                          If you did not request a password reset, please ignore this email. Your account will remain unchanged.

                          Best regards,
                          ParkingLots System Team
                          """
            };

            var SmtpServer = Email["SmtpServer"] ?? throw new InvalidOperationException("Email:SmtpServer is missing.");

            using var client = new SmtpClient();

            var port = int.TryParse(Email["Port"], out var configuredPort) ? configuredPort : 587;

            Console.WriteLine("SMTP: Connecting...");
            await client.ConnectAsync(
                SmtpServer, port,
                SecureSocketOptions.StartTls,
                cancellationToken);
            Console.WriteLine("SMTP: Connected");

            Console.WriteLine("SMTP: Authenticating...");
            await client.AuthenticateAsync(
                Sender, AppPassword, cancellationToken);
            Console.WriteLine("SMTP: Authenticated");

            Console.WriteLine("SMTP: Sending...");
            var response = await client.SendAsync(
                message, cancellationToken);
            Console.WriteLine($"SMTP: Sent. Response: {response}");

            await client.DisconnectAsync(true, cancellationToken);


        }
    }
}
