# Comment deletion rollout

Author deletion removes their text and identity. It never cascades into other readers' replies. Shared comment normalization and immediate local updates hide deleted leaves and empty deleted ancestors, retaining only tombstones needed to connect surviving replies. This applies to the feed sheet and Post/Conversation routes used by club/profile post links.

The feed uses FullWindowOverlay on iOS. Its confirmation must be an embedded sibling inside that window layer, not a separate React Native Modal behind it. Delete now uses the existing action-sheet dismissal handoff rather than a fixed timer. Confirmation text explains preserved replies. Failed mutations keep the confirmation available for retry.

The additive migration replaces only delete_post_comment(uuid), checks the legacy return type is void before writing, requires an active unrestricted author and clears content/identity in place. No physical deletion means concurrent replies cannot be lost to a cascading FK. Notifications for the removed comment are cleared, cancelling pending delivery through the existing outbox FK; replies' own notifications remain. Other readers' comments cannot be deleted through this RPC. Already deleted/missing rows are harmless on retry.

After pulling beta-updates and exporting the copied CLI token, run:

```
node scripts/deploy-push-previews.mjs
node scripts/deploy-comment-deletion.mjs
```

Both commands use Database Read/write. No Edge secret changes, worker redeployment or cron changes are needed. Preview text is backend-only. Comment UI changes require refreshing the development bundle for testing and a new TestFlight build for testers.

Test a leaf, a parent with replies, and deletion of the last live reply below a removed parent. Check cancellation, failed-request retry, the scrolled feed sheet, a club/profile-linked Post route and a focused Conversation route. Confirm on a physical iPhone before release; local tests cannot establish OS overlay presentation.
