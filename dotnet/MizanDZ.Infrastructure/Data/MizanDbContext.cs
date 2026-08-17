using Microsoft.EntityFrameworkCore;
using MizanDZ.Domain.Entities;

namespace MizanDZ.Infrastructure.Data
{
    public class MizanDbContext : DbContext
    {
        public DbSet<User> Users => Set<User>();
        public DbSet<Category> Categories => Set<Category>();
        public DbSet<Brand> Brands => Set<Brand>();
        public DbSet<Product> Products => Set<Product>();
        public DbSet<Customer> Customers => Set<Customer>();
        public DbSet<Supplier> Suppliers => Set<Supplier>();
        public DbSet<StockMovement> StockMovements => Set<StockMovement>();
        public DbSet<Sale> Sales => Set<Sale>();
        public DbSet<SaleItem> SaleItems => Set<SaleItem>();
        public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
        public DbSet<Expense> Expenses => Set<Expense>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

        public MizanDbContext(DbContextOptions<MizanDbContext> options) : base(options) { }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                optionsBuilder.UseSqlite("Data Source=mizan_dz.sqlite");
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Indexes
            modelBuilder.Entity<Product>()
                .HasIndex(p => p.Barcode)
                .IsUnique();

            modelBuilder.Entity<Product>()
                .HasIndex(p => p.Name);

            modelBuilder.Entity<Sale>()
                .HasIndex(s => s.InvoiceNumber)
                .IsUnique();

            // Precision for Currency (DZD)
            modelBuilder.Entity<Product>().Property(p => p.PurchasePrice).HasPrecision(18, 2);
            modelBuilder.Entity<Product>().Property(p => p.SalePrice).HasPrecision(18, 2);
            modelBuilder.Entity<Product>().Property(p => p.WholesalePrice).HasPrecision(18, 2);
            modelBuilder.Entity<Customer>().Property(c => c.Balance).HasPrecision(18, 2);
            modelBuilder.Entity<Supplier>().Property(s => s.Balance).HasPrecision(18, 2);
            modelBuilder.Entity<Sale>().Property(s => s.GrandTotal).HasPrecision(18, 2);
            modelBuilder.Entity<Expense>().Property(e => e.Amount).HasPrecision(18, 2);

            // Soft Delete Query Filter for Products
            modelBuilder.Entity<Product>().HasQueryFilter(p => !p.IsDeleted);
        }
    }
}
