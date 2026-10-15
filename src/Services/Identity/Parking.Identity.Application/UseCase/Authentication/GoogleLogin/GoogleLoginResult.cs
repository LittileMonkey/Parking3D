namespace Parking.Identity.Application.UseCase.Authentication.GoogleLogin
{
    public sealed record GoogleLoginResult(
      string AccessToken,
      string RefreshToken
  );
}