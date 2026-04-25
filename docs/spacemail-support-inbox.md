# SpaceMail support inbox

FondosEG can sync replies sent to `support@fondoseg.com` through IMAP and save them in
`support_messages` as inbound support records.

## Environment variables

Use SpaceMail IMAP credentials for the support mailbox:

```env
SUPPORT_EMAIL=support@fondoseg.com
SUPPORT_EMAIL_IMAP_HOST=my.space.email
SUPPORT_EMAIL_IMAP_PORT=993
SUPPORT_EMAIL_IMAP_USER=support@fondoseg.com
SUPPORT_EMAIL_IMAP_PASSWORD=replace-with-spacemail-mailbox-password
SUPPORT_EMAIL_IMAP_MAILBOX=INBOX
SUPPORT_EMAIL_MARK_SEEN=true
SUPPORT_EMAIL_SYNC_SECRET=replace-with-a-long-random-secret
```

If the mailbox is hosted by Hostinger Email instead of Space Email, use:

```env
SUPPORT_EMAIL_IMAP_HOST=imap.hostinger.com
SUPPORT_EMAIL_IMAP_PORT=993
```

## Sync endpoint

Call the worker endpoint from a cron job:

```bash
curl -X POST https://fondoseg.com/api/support/email-sync \
  -H "Authorization: Bearer $SUPPORT_EMAIL_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":20}'
```

The sync imports unseen mailbox messages, stores them once using the email
`Message-ID`, creates an admin notification when possible, and marks imported
emails as seen unless `SUPPORT_EMAIL_MARK_SEEN=false`.
