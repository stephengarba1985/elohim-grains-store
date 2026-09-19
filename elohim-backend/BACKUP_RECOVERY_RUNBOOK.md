# Backup and recovery runbook

Backups are considered valid only after a restore test succeeds. This runbook
covers customers, orders, payments, the immutable financial ledger, wallet and
savings records, inventory movements, vendor settlements, and audit logs.

## Recovery targets

Set these with the database provider and review them quarterly:

- **Target RPO:** 15 minutes or less. This is the maximum acceptable data loss.
- **Target RTO:** 4 hours or less. This is the maximum acceptable outage before
  Elohim can resume operating.

If the provider cannot meet these targets, record the actual RPO/RTO and obtain
an operational decision before production launch.

## Backup configuration (production owner)

1. Enable automated encrypted backups and point-in-time recovery with the
   production database provider.
2. Retain daily backups for at least 35 days and retain monthly backups under
   the business retention policy.
3. Restrict backup access to named production/finance administrators. Do not
   download backups onto personal devices.
4. Alert the operations owner if a scheduled backup fails.

## Monthly restore drill

1. Select a recent backup and restore it into an isolated, non-production
   database. Never test a restore over the live production database.
2. Use separate temporary credentials and do not connect the restored instance
   to payment webhooks, email, WhatsApp, or live workers.
3. Set `DATABASE_URL` to the restored database and run:

   ```powershell
   $env:RESTORE_VALIDATION='true'
   npm run verify:restore
   ```

4. Confirm the validator reports all critical tables. Record the displayed
   counts, restore start/end time, backup timestamp, tester, and result in the
   protected operations log.
5. Have Finance reconcile a sample of orders against payment transactions and
   financial-ledger entries. Have Operations reconcile a sample of order items
   against stock history and vendor payouts where applicable.
6. Destroy the isolated restored environment and revoke its temporary
   credentials when the drill is finished.

## Real incident recovery

1. Declare the incident and pause writes, payment fulfilment, background jobs,
   and settlement releases.
2. Identify the last known-good restore point. State the expected data-loss
   window to the incident lead.
3. Restore to a new isolated database, run `npm run verify:restore`, and
   complete the finance/operations reconciliation above.
4. Switch the application only after approval from Operations and Finance.
5. Reconcile provider payments received after the restore point before marking
   any affected order as paid or crediting any wallet.
6. Document the RPO actually lost, restoration time, affected customers, and
   corrective actions.
