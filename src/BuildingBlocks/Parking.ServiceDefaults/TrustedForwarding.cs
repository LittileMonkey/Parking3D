using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
namespace Parking.ServiceDefaults;
public static class TrustedForwarding
{
 public static void UseTrustedForwarding(this WebApplication app)
 {
  var cidr=app.Configuration["ForwardedHeaders:KnownNetwork"];
  if(string.IsNullOrWhiteSpace(cidr))return;
  var parts=cidr.Split('/');
  if(parts.Length!=2||!IPAddress.TryParse(parts[0],out var address)||address.AddressFamily!=System.Net.Sockets.AddressFamily.InterNetwork||!int.TryParse(parts[1],out var prefix)||prefix<16||prefix>32)throw new InvalidOperationException("Configure a narrow trusted IPv4 proxy network");
  var options=new ForwardedHeadersOptions{ForwardedHeaders=ForwardedHeaders.XForwardedFor|ForwardedHeaders.XForwardedProto,ForwardLimit=3};
  options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(address,prefix));
  app.UseForwardedHeaders(options);
 }
}
