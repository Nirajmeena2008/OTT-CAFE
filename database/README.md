# Database (MySQL)

`schema.sql` is the complete table layout (10 tables): orders, reservations, menu_items,
categories, promo_banners, cafe_info, invoices, customers, admin_users, audit_logs.

You normally never run it by hand: the backend creates any missing table on startup, adds new
columns to older databases, and seeds the menu, categories and banners into an empty database
(see `server/mysql.ts` and `server/mysqlService.ts`). It is here as a reference, and for setting
up a database manually if ever needed:

```bash
mysql -u <user> -p <database_name> < database/schema.sql
```

## Live data is not in this repository

Orders, bookings, customers and staff accounts live only in the production MySQL database on
the server. They contain customers' personal details, so they are deliberately **not** stored
in Git. Back them up on the server instead, e.g. a daily job:

```bash
mysqldump -u <user> -p <database_name> > ott-backup-$(date +%F).sql
```
