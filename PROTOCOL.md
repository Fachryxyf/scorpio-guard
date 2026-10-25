# Scorpio Guard Protocol - v0.1 (draft)

Wire format for the symptom/prescription exchange.

**The library still transmits nothing on its own.** D17 removed the API key and D20
made a serverless guard fully functional, so there is no default destination and no
sender started by an import. What exists is the executable side of this document:
`src/core/protocol.ts` encodes and decodes, `protocol/fixtures/v0.1/` holds the cases
a conforming implementation has to pass, and `examples/protocol/` contains a reference
receiver and a batching sender. It lives in this repository until
`scorpio-guard-protocol` exists, so the vocabulary in `src/core/symptoms.ts` and the
format described here cannot drift apart while both are moving.

The vocabulary is the normative part and is already written. This document adds
only what a wire format has to decide beyond it: framing, versioning, what a
response may contain, and what a receiver does with a message it does not fully
understand.

---

## 1. What travels, and what must not

One direction: an instance reports shapes it observed, and receives strategies for
handling that class of shape. The prescription travels; the patient does not.

A conforming message MUST NOT contain:

- any entity key, session id, IP address, or user agent
- any raw observation: counts, intervals, timestamps, endpoint paths, record ids
- any trust state: mean, variance, evidence mass, decision
- any free-text field

A conforming message MAY contain only tokens from the published vocabulary, the
schema version, and a coarse count of how many distinct entities exhibited a
shape - bucketed, never exact (section 4).

The constraint is structural rather than a policy: the message type has no field
in which raw data would fit. An implementation that needs to add one has left the
protocol.

## 2. Framing

HTTP POST, `Content-Type: application/json`, one JSON object per request. The
transport is deliberately boring: symptom reporting is low-rate, low-urgency, and
tolerant of loss, so nothing here justifies a streaming protocol or a binary
encoding.

```
POST /v0/symptoms
```

Requests are idempotent and unauthenticated. An instance identifies itself with
nothing, because a report that could be attributed to an instance is a report
about a population. Rate limiting is therefore by transport-level address, and a
server MUST treat the absence of identity as normal rather than as an error.

## 3. Request

```json
{
  "protocol": "sg/0.1",
  "schema": 1,
  "reports": [
    { "category": "SYM_TIMING", "detail": "SYM_UNIFORM_DELAY_SHAPE", "entities": "few" },
    { "category": "SYM_TARGET", "detail": "SYM_BROAD_ENUMERATION", "entities": "several" }
  ]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `protocol` | string | yes | `sg/<major>.<minor>`. A receiver MUST reject an unknown major. |
| `schema` | integer | yes | `SYMPTOM_SCHEMA_VERSION` the sender shipped with. |
| `reports` | array | yes | One entry per observed shape. An empty array is valid and means nothing was observed. |
| `reports[].category` | string | yes | A `SYMPTOM_CATEGORIES` token. Transmitted with the detail, never derived from it. |
| `reports[].detail` | string | yes | A detail token. May be one the receiver has never heard of. |
| `reports[].entities` | string | yes | Bucketed count. See section 4. |

`category` is sent alongside `detail` and not inferred from it. That is the point
of the two-tier split (D43): a receiver too old to know the detail can still act on
the category, and it cannot look up what it does not have.

## 4. Entity counts are buckets, not numbers

```
"one" | "few" | "several" | "many"
```

An exact count is a fingerprint. "Three entities showed this shape" is identifying
in a small deployment in a way "few" is not, and the receiver's decision does not
improve from the precision. Bucket boundaries are a sender-side policy and are
deliberately not specified here: publishing them would let an attacker infer
deployment size from a boundary crossing.

A receiver MUST treat these as ordered labels and MUST NOT attempt to recover a
number from them.

## 5. Response

```json
{
  "protocol": "sg/0.1",
  "prescriptions": [
    {
      "category": "SYM_TIMING",
      "detail": "SYM_UNIFORM_DELAY_SHAPE",
      "strategy": "TIGHTEN_TIMING_TOLERANCE",
      "confidence": "provisional"
    }
  ]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `strategy` | string | yes | A general handling strategy. Not a decision, and never per-entity. |
| `confidence` | string | yes | `provisional` or `corroborated`. Whether the server has seen this shape widely enough to mean it. |

A prescription is advice about a *class*, not a verdict about an entity - the
server has never been told which entities are involved and structurally cannot
issue one. The strategy vocabulary is intentionally left open in v0.1: it is the
part with the least design behind it, and inventing tokens before a server exists
would be guessing.

A receiver MUST ignore a strategy it does not recognise, and MUST NOT treat an
unrecognised strategy as a reason to escalate.

## 6. Degradation rules

These are the compatibility guarantees, and they are why the tier split exists:

1. **Unknown detail, known category** - accept, and act on the category. This is
   the normal forward-compatibility path and MUST NOT be an error.
2. **Unknown category** - reject that report. There is nothing left to fall back
   to, and guessing would invent a semantics the sender did not mean.
3. **Newer `schema`** - accept. A higher schema means new details exist, which
   rule 1 already covers.
4. **Unknown `protocol` major** - reject the whole message.
5. **Unknown fields** - ignore them; reject only on a missing required one. An
   instance that ships tomorrow must be able to add a field without breaking a
   server deployed today.

`readSymptom` in `src/core/symptoms.ts` already implements rules 1 and 2, which is
why they are stated as behavior rather than as intent.

## 7. What v0.1 does not decide

Named rather than glossed over:

- **Strategy vocabulary.** Left open, see section 5.
- **Transport encryption.** TLS is assumed and not specified. A future version has
  to say something about a server that sees traffic patterns even when it sees no
  content.
- **Batching and cadence.** Decided for this implementation in section 10 and D71. The
  numbers are policy and another sender may pick different ones; the guarantee is that
  sending is periodic rather than triggered by the event being reported.
- **Server-only readable encoding.** Still research, not design. If it lands it
  changes section 3 and nothing else.
- **Replay and poisoning.** An unauthenticated endpoint accepting idempotent
  reports can be flooded with fabricated shapes. Bucketing limits the damage per
  request; nothing here stops a patient attacker from pushing `confidence` upward,
  and that is an open problem rather than a solved one. The replay window in section 10
  is a delay, not the defence.

## 8. Conformance

An implementation conforms to v0.1 when it:
1. sends only tokens present in the vocabulary it shipped with;
2. sends `category` explicitly on every report;
3. buckets entity counts and never sends an exact one;
4. applies every rule in section 6, including accepting an unknown detail;
5. ignores an unrecognised strategy rather than escalating on it;
6. includes no field carrying raw observation, identity, or trust state.

Point 6 is the one worth testing adversarially: it is the guarantee the whole
privacy argument rests on, and the only one whose violation is invisible to the
sender. It is also the one point where an unknown field is not ignored: a field named in
section 1 rejects the whole message with `FORBIDDEN_FIELD` before any other rule runs
(D70). Rule 5 keeps its meaning for every other field.

The cases live in `protocol/fixtures/v0.1/`, one JSON file each, twenty-two of them.
Every implementation of this document runs them, on every test run: the encoder and
decoder in `src/core/protocol.ts`, and the reference receiver in
`examples/protocol/validate.ts`. When the two disagree, the fixture wins and one of them
has a bug.

## 9. Relationship to the design record

| Ref | Bearing on this document |
|---|---|
| D8, D9 | One-way reporting; the guard advises and never receives a verdict |
| D17, D20 | No API key, no required server - which is why nothing transmits yet |
| D43 | Two-tier vocabulary, and the degradation rules of section 6 |
| D19 | What data the project needs: pattern shape, not identity |
| D70 | Why section 8 rejects a section 1 field instead of ignoring it |
| D71 | The sender cadence, the receiver retention, and the abuse control below |

Changes to this document belong in `DECISIONS.md` first. The format is downstream
of the reasoning, not a place to make new decisions quietly.

---

## 10. Operational defaults

Not part of the wire format. This is what the reference receiver and the shipped sender
do, recorded so a second implementation starts from a decision instead of a guess (D71).
A deployment may choose different numbers; a deployment that changes the shape of the
guarantee has to change this document first.

| Concern | Default | Reason |
|---|---|---|
| Send trigger | a batch of 20, or a 60 second cadence | periodic, never triggered by the reported event |
| Undeliverable batch | dropped after one attempt | a retry log is a timeline with fresh timestamps |
| Receiver retention | one hour of shape aggregates | nothing to erase, and the obligation expires with the window |
| Replay | digest of the whole body, window equal to retention | a sender retry cannot inflate one sighting into corroboration |
| Abuse control | 60 requests per minute per transport address | the address is the only identifying value and it is pruned with the window |
| Body size | 64 KiB | refused before parsing |
| Corroboration | three sightings of the same shape | provisional until then |

A receiver that keeps aggregates instead of messages has no body to delete, which is the
point: the privacy argument of section 1 is easier to hold when the data was never
written down.
