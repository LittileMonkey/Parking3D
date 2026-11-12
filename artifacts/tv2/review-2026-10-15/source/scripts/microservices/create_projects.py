"""Create project files only; does not overwrite business code."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
for service in ['Identity','Parking','Payment','AI']:
    base=ROOT/'src/Services'/service
    for layer in ['Domain','Application','Infrastructure','Api']:
        name=f'Parking.{service}.{layer}'
        p=base/name;p.mkdir(parents=True,exist_ok=True)
        refs=[]
        packages=[]
        if layer=='Application':refs=[f'../Parking.{service}.Domain/Parking.{service}.Domain.csproj']
        if layer=='Infrastructure':
            refs=[f'../Parking.{service}.Application/Parking.{service}.Application.csproj', '../../../BuildingBlocks/Parking.ServiceDefaults/Parking.ServiceDefaults.csproj','../../../Contracts/Parking.Contracts/Parking.Contracts.csproj']
        if layer=='Api':
            refs=[f'../Parking.{service}.Infrastructure/Parking.{service}.Infrastructure.csproj']
        framework='<FrameworkReference Include="Microsoft.AspNetCore.App" />' if layer=='Infrastructure' else ''
        text=f'<Project Sdk="Microsoft.NET.Sdk{ ".Web" if layer=="Api" else ""}">\n  <ItemGroup>\n'
        text+='\n'.join(f'    <ProjectReference Include="{r}" />' for r in refs)
        text+='\n    '+framework+'\n  </ItemGroup>\n</Project>\n'
        (p/(name+'.csproj')).write_text(text,encoding='utf-8')
        if layer=='Domain':
            (p/'ServiceBoundary.cs').write_text(f'namespace Parking.{service}.Domain;\n\npublic static class ServiceBoundary\n{{\n    public const string Name = "{service.lower()}";\n}}\n',encoding='utf-8')
print('Created 16 independently scoped layer projects.')
