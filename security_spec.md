# Security Specification - Messenger App

## Data Invariants
1. A Chat MUST have exactly 2 participants.
2. A Message MUST have a `senderId` matching `request.auth.uid`.
3. A Story MUST expire 24 hours after creation.
4. Users can only read chats if their UID is in the `participants` array.
5. Users can only write messages to chats they are part of.

## The Dirty Dozen Payloads

| ID | Collection | Action | Payload | Expected | Reason |
|----|------------|--------|---------|----------|--------|
| D1 | /users/attacker | create | { uid: 'victim', ... } | Deny | Spoofing UID |
| D2 | /chats/rand | create | { participants: ['victim1', 'victim2'] } | Deny | Attacker not participant |
| D3 | /chats/chat1/messages/m1 | create | { senderId: 'victim', text: 'hi' } | Deny | Spoofing senderId |
| D4 | /chats/chat1/messages/m1 | create | { senderId: 'attacker', text: 'a'.repeat(2000) } | Deny | Text too long |
| D5 | /users/victim | update | { displayName: 'Hacked' } | Deny | Not owner |
| D6 | /stories/s1 | create | { userId: 'victim', ... } | Deny | Story owner spoofing |
| D7 | /chats/chat_not_mine | read | - | Deny | Unauthorized access to chat metadata |
| D8 | /chats/chat1/messages/m1 | update | { text: 'modified' } | Deny | Messages should be immutable or strictly controlled |
| D9 | /users/me | create | { admin: true } | Deny | Privilege escalation |
| D10 | /stories/s1 | create | { expiresAt: far_future } | Deny | Invalid expiration |
| D11 | /chats/chat1/messages/m1 | create | { mediaUrl: 'bad_url', mediaType: 'text' } | Deny | Media mismatch |
| D12 | /chats/chat1 | delete | - | Deny | Permanent record maintenance |

## Test Runner (Conceptual)
`firestore.rules.test.ts` would verify these.
