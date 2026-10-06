using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Domain.Entities;

namespace Template.Application.Common.Interface
{
    public interface IAccountRepository
    {
        Task<AccountMember> GetAccountByIdAsync(string accountId);
        Task<List<AccountMember>> ListAccountsAsync();
        Task<AccountMember> GetAccountByEmailAsync(string email);

        Task<AccountMember> CreateAccountAsync(AccountMember account);
        Task UpdateAccountAsync(AccountMember account);
        Task DeleteAccountAsync(AccountMember account);

    }
}
