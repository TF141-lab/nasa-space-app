# Security Specification: Starbound Outpost

## 1. Data Invariants
1. **Save Ownership**: An `OutpostSave` document (`/saves/{saveId}`) can only be created, read, or updated by its authenticated owner (`ownerId == request.auth.uid`) with `email_verified == true`.
2. **Terminal State Locking**: Once an `OutpostSave` reaches `status == 'victory'` or `status == 'failed'`, no further updates are permitted.
3. **Mission Log Immutability**: A `MissionLog` document (`/missionLogs/{logId}`) can only be created by a verified owner (`ownerId == request.auth.uid`), is immutable once created (`allow update, delete: if false`), and list/get operations must evaluate `resource.data.ownerId == request.auth.uid` so no cross-user data scraping is possible.
4. **Strict Timestamps & Bounds**: Every string field enforces strict `.size()` bounds and `createdAt`/`updatedAt` strictly match `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing on Create**: `ownerId: "other_uid"` when `request.auth.uid == "user_1"`.
2. **Unverified Email Create**: Valid payload but `request.auth.token.email_verified == false`.
3. **Shadow Field Injection on Create**: Adding `"isAdmin": true` to `/saves/{saveId}`.
4. **Shadow Field Injection on Update**: Updating `/saves/{saveId}` with an extra `"hacked": 1` key.
5. **Terminal State Bypass**: Updating a save document whose existing `status` is `'victory'`.
6. **Value Poisoning on Resource**: Setting `power: 9999` or `power: "high"` (out of bounds / wrong type).
7. **ID Poisoning**: Creating a document with a 200-char ID or invalid characters (`save$123`).
8. **Temporal Forgery on Create**: Passing a client timestamp `createdAt` != `request.time`.
9. **Temporal Forgery on Update**: Updating `/saves/{saveId}` where `updatedAt` != `request.time`.
10. **Immortal Field Mutation**: Attempting to mutate `ownerId` or `createdAt` during an update.
11. **Unauthorized List Scraping**: Listing `/saves` or `/missionLogs` without `resource.data.ownerId == request.auth.uid`.
12. **MissionLog Mutation**: Attempting to update or delete an existing `/missionLogs/{logId}` entry.
