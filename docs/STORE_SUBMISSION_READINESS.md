# Novori legal and store submission review

Reviewed October 4, 2026. Operator: **Tristan McMillin**, an individual. Audience: **18+ only**. Contact: **support@novori.link**.

The legal documents and app links are implemented. This is **not a certification that the app is ready for store approval or legally compliant in every country**. The release build, provider agreements, operating procedures, and console declarations must agree with these documents. Do not submit until the open items below are resolved. A qualified legal review is appropriate before public launch, especially for launch territories, child-safety reporting duties, and international data processing.

## Public URLs for the store forms

| Field | URL |
| --- | --- |
| Privacy policy, both stores | https://novori.link/privacy/ |
| Service terms | https://novori.link/terms/ |
| Open-source notices | https://novori.link/licenses/ |
| Google Play external account-deletion URL | https://novori.link/delete-account/ |
| Google Play child-safety standards | https://novori.link/child-safety/ |
| Support URL | https://novori.link/support/ |

Verify that each URL loads publicly after Cloudflare deployment, including from a signed-out mobile browser. Update Cloudflare watch paths to include `website/**`, `src/generated/open-source-notices.json`, and `package-lock.json` if path filtering is enabled.

## Implemented in this change

- Terms identify the individual operator, adult-only eligibility, community rules, content rights, enforcement and appeals, provider rights, deletion, and mandatory consumer-law protections.
- Privacy policy covers account and reading data, private notes, community content, reports, technical logs, book-search requests, selected photos/camera, deletion, retention, privacy requests, and the actual service providers.
- Providers include Supabase, Google Books, Hardcover, Open Library/Covers, Resend, Cloudflare, Expo, and **Google ML Kit/code-scanning SDKs on Android**. GitHub source/build hosting is distinguished from app-user data processing. There is no claim that the Android barcode SDK sends no diagnostic data.
- Native app readers and static public pages use the same document source: `website/legal-documents.json`.
- Signup has separate unchecked adulthood and agreement confirmations. Policy versions, an age attestation, and an acceptance timestamp are stored in Supabase Auth user metadata. No full date of birth is requested.
- Existing signed-in readers must accept before interacting with community screens. Reading legal documents, getting help, and managing/deleting an account remain accessible without agreement.
- Age confirmation and metadata are **self-attestation**, not verified age or a server authorization mechanism. User metadata is editable by its owner; do not describe it as an immutable compliance audit log.
- Full license/copyright texts are generated for the production npm dependency graph, transitive dependencies, relevant fonts/icons, and listed native dependencies. Unknown missing notices stop generation. Regenerate and review after dependency changes.
- Camera/photo permission descriptions now cover actual profile/post/club photo use as well as barcode scanning. Installing a new native build is required to see these updated system permission messages.

## Items that remain before submission

### 1. Content moderation is a launch blocker to resolve

Apple guideline 1.2 requires a method for filtering objectionable material **from being posted**, reporting, timely responses, blocking, and published contact information. Google also requires robust UGC moderation and agreement to the rules before uploading content.

The existing Novori language filter explicitly describes itself as **profanity-only**, not a classifier for sexual material, violence, hate speech, or images. Existing report/block tools and the private admin dashboard are useful, but an optional reader profanity preference is not proof of adequate pre-publication safeguards. Test all published-content surfaces and adopt an enforceable prevention/moderation workflow before launch. Do not tell a reviewer that photos or harmful content are automatically screened when they are not. This legal update does not silently change the book-search or moderation architecture.

Confirm reports reach the admin inbox, removal and suspension work, blocked accounts cannot interact, and an operator regularly handles reports and appeals. Give reviewers exact report/block instructions and a working non-admin demo account. Do not expose admin credentials.

### 2. Google Books attribution and result handling need a separate provider review

Google's Books branding guidance requires attribution near results and book information, prominent Google Books links, and specific treatment of Google search results, including restrictions on mixing/reordering. Current Novori book search blends a cached catalog and provider data and ranks some results. **Naming Google in the legal pages does not cure those requirements.** Review the current Google API agreement and obtain any necessary permission or adjust the provider-result presentation before launch. Preserve book-cover quality while resolving this; no search, cache, ranking, or cover changes are included in the legal update.

Confirm Hardcover's applicable API access/commercial-use terms directly with Hardcover. Its terms pages were not reliably retrievable during this review; no unverified license or permission is asserted. Open Library metadata licensing does not automatically make cover art public domain. Check cover/content rights and required notices for all sources.

### 3. Complete age and identity settings in both consoles

An individual developer can publish Novori; no invented company name is needed. Use the actual verified developer identity. Apple displays an individual developer's legal name as the seller. Store verification or territory-specific trader rules may require an address/phone; use accurate information and assess what the store publishes. No postal address, state of residence, incorporated entity, or registration number was invented in the legal pages.

Apple: answer the current age-rating questionnaire accurately, including user-generated content and social functionality. Apply the higher age-category override needed for Novori's 18+ service policy. Do not select the Kids category. Rating descriptors and territorial ratings may differ.

Google Play: select **18 and over** as the intended target audience and configure **Restrict minor access** where available/applicable. Answer IARC ratings honestly; adult targeting does not mean all content is permitted. If classified as Social, complete the child-safety standards declaration and designate **Tristan McMillin / support@novori.link** as the contact.

A full birth date at every sign-in is not a universal store requirement. However, a checkbox is not proof of legal age everywhere. Confirm the age-assurance requirements for the actual launch territories, including any applicable platform age-signal obligations or local laws. Do not offer a minors mode or claim verified ages on the basis of this attestation.

### 4. Fill Apple App Privacy and Google Data safety from the release build

These forms are separate from the Privacy Policy. Do not choose "no data collected" just because there is no ad SDK. Review the actual release build and backend practices, including third-party SDKs.

| Actual data/function | Categories to review in store forms | Principal purpose / handling |
| --- | --- | --- |
| Email and display/profile names | Contact info / personal info | Account management and functionality; linked to the account |
| Supabase user ID, auth/security records | User IDs, relevant identifiers and diagnostics | Authentication and security |
| Posts, comments, reviews, private notes and support messages | Other user content, messages, customer support / other app content as applicable | Functionality and support; public or restricted according to the feature |
| Profile/post/club images | Photos / user content | Uploaded only when chosen; audience depends on feature |
| Library, progress, goals, votes, follows, memberships and reminders | App interactions / product interaction / other user content | Reading and community functionality; account-linked |
| Search terms, book identifiers and API counters | Search history / app activity, as applicable | Book lookup, caching, quotas and operation; direct requests expose connection data to providers |
| Reports, blocks and moderation records | User content / app activity / relevant personal info | Security, abuse prevention and moderation; restricted administration |
| Host request/error/security logs | Diagnostics and applicable identifiers | Security and reliable operation; check provider retention |
| Android ML Kit/code scanner | Device/installation identifiers, diagnostics and SDK usage/app information | Google's SDK diagnostics and usage analytics; include vendor data-disclosure requirements |
| Typed event address/location and meeting links | User content and location where appropriate | User-entered event information; no device GPS permission in current app |
| Time zone and preferences | App functionality / relevant app information | Reading reminders and preferences; not precise GPS location |

These are mappings to review, not prefilled declarations: Apple's and Google's definitions of "collected," "shared," "tracking," optional collection, and service-provider processing differ. Select the applicable purposes, linkage, retention, and deletion options accurately. There is no advertising SDK in the current package audit and no identified cross-app ad-tracking flow. Reassess before introducing ads, payments, tracking, or new SDKs.

### 5. Verify the final native binaries and license inventory

Run `npm ci`, `npm run licenses:generate`, `npm run licenses:check`, tests, and a production export after dependency changes. Upstream fallback license snapshots are checked in with source URLs and hashes; they must be reviewed rather than automatically replaced with arbitrary current license text.

**The repository has no final iOS Podfile.lock or Android release dependency report.** The listed native notices were audited against installed package specifications, but this cannot establish the complete transitive native inventory of the actual signed IPA/AAB. Before submission, compare resolved CocoaPods and Gradle release dependencies (including image codecs, AndroidX, Kotlin, Google SDKs and their license/NOTICE files) with the inventory and incorporate any additional required notices. Do not claim a complete binary license certification from an npm lockfile alone. Keep any relevant source-availability obligations for copyleft components; supporting tooling such as Lightning CSS has MPL-2.0 notices and source links.

For iOS, inspect the generated app/SDK privacy manifests and Required Reason API entries in the **archived release app**, including React Native and AsyncStorage, not just source templates. Confirm manifest aggregation and required SDK signatures in Xcode/App Store Connect validation. A JS export is not an IPA or store validation.

For Android, inspect the merged release manifest and permissions, including camera and photo picking. Novori selects individual photos and should not request broad photo/video-library access it does not need. The installed Expo Image Picker manifest limits legacy storage permission to older Android versions; verify the final manifest rather than assuming that no transitive module adds permissions. Microphone recording is disabled for the camera/photo plugins. Confirm the current target API, signing identity, and Play verification requirements in the release console.

### 6. Operate the promises in the policies

- Monitor support@novori.link for support, appeals, privacy, deletion, and child-safety requests. Ensure routing/delivery works and the contact is actually staffed.
- External deletion is a **manual email support flow**, allowed as a request pathway by Google. The webpage alone does not process requests. Verify ownership, arrange any club transfer, initiate the same full deletion workflow, follow applicable deadlines, and confirm completion. Do not merely delete the Auth row or ban the user: storage, authored content, reading data, and associated records must be handled by the deletion orchestration.
- Verify the in-app seven-day cancellation and Delete now flows against production with a disposable account. Confirm Auth deletion, upload cleanup, reading/note removal, anonymous text-free tombstones, and preservation of other readers' replies. The source calls database RPCs whose deployed definitions are not present in this checkout; this audit does not re-certify the live database cleanup.
- Inventory provider log/backup retention and security/moderation exceptions, set operational deletion deadlines, and prevent backups from silently reactivating deleted accounts. Exact backend retention periods were not invented in the public policy.
- Configure applicable provider data-processing agreements and international-transfer safeguards. The public wording is not a replacement for those agreements.
- For suspected CSAM, do not download or forward material through ordinary email. Have a lawful reporting/preservation process, including NCMEC or relevant regional authorities where required, and train the designated contact. A public policy is not itself a reporting operation.

## Sources checked

- [Apple App Review Guidelines, especially 1.2 and 5.1](https://developer.apple.com/app-store/review/guidelines/)
- [Apple in-app account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple privacy disclosures](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple age rating and override](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)
- [Apple individual developer enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Google User Data and account deletion](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google external deletion resource guidance](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937)
- [Google child-safety standards, including adult-only apps](https://support.google.com/googleplay/android-developer/answer/14747720)
- [Google target audience settings](https://support.google.com/googleplay/android-developer/answer/9867159)
- [Google Books terms](https://developers.google.com/books/terms) and [branding rules](https://developers.google.com/books/branding)
- [Open Library licensing](https://openlibrary.org/developers/licensing)
- [ML Kit terms/privacy](https://developers.google.com/ml-kit/terms) and [Android data-disclosure guidance](https://developers.google.com/ml-kit/android-data-disclosure)

Recheck requirements at the actual submission date. Territory-specific privacy, age-assurance, consumer, and child-safety laws are not comprehensively certified by this store-focused review.
