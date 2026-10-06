using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Application.Common.Interface;
using Template.Domain;
using Template.Domain.Entities;

namespace Template.Persistence.Repositories
{
    public class AccountRepository : IAccountRepository
    {
        public readonly MyStoreContext context;

        public AccountRepository(MyStoreContext context)
        {
            this.context = context;
        }

        public async Task<AccountMember> CreateAccountAsync(AccountMember account)
        {
            var entry =  await context.AccountMembers.AddAsync(account);
            return entry.Entity;
        }

        public Task DeleteAccountAsync(AccountMember account)
        {
            context.AccountMembers.Remove(account);
            return Task.CompletedTask;
        }

        public async Task<AccountMember> GetAccountByEmailAsync(string email)
        {
            return await context.AccountMembers.FirstOrDefaultAsync(a => a.EmailAddress == email);
        }

        public async Task<AccountMember> GetAccountByIdAsync(string accountId)
        {
            return await context.AccountMembers.FirstOrDefaultAsync(a => a.MemberId == accountId);
        }

        public async Task<List<AccountMember>> ListAccountsAsync()
        {
            return await context.AccountMembers.ToListAsync();
        }

        public Task UpdateAccountAsync(AccountMember account)
        {
            context.AccountMembers.Update(account);
            return Task.CompletedTask;
        }
    }
}
