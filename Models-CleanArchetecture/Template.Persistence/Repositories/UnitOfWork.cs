using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Application.Common.Interface;

namespace Template.Persistence.Repositories
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly MyStoreContext context;
        public UnitOfWork(MyStoreContext context)
        {
            this.context = context;
        }
        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await context.SaveChangesAsync(cancellationToken);
        }
    }
}
