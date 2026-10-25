# Protocol fixtures - v0.1

One JSON file per case. Every implementation of the protocol reads these files and
must produce the expected result, field for field, without reading the others.

```
{
  "name": "accept-unknown-detail",
  "rule": "6.1",
  "why": "why this case exists, in one sentence",
  "request": { "protocol": "sg/0.1", "schema": 1, "reports": [] },
  "expect": {
    "ok": true,
    "reports": [{ "category": "SYM_TIMING", "detail": null, "entities": "few" }],
    "dropped": 0
  }
}
```

A rejection expectation is `{ "ok": false, "code": "UNSUPPORTED_MAJOR" }`, plus
`"field"` when the code is `FORBIDDEN_FIELD`.

The normalised success result is the same for every implementation:

- `reports[].detail` is `null` when the receiver does not know that detail (rule 1);
- `dropped` counts reports the receiver could not use (section 6 rule 2, section 4);
- nothing else is returned. There is no field for the raw request.

`rule` refers to `PROTOCOL.md`: `6.x` are degradation rules, `4` is the bucket
requirement, `3` is the request shape, and `1` is the prohibition that a message
carries no identity or raw observation. Cases named `reject-forbidden-field-*` are
the one place where an extra field is a rejection rather than an ignore;
`PROTOCOL.md` section 8 says why.

This directory moves to its own repository once the protocol outlives this
package. Until then it lives beside the two implementations in this repo: the
library encoder and decoder (`src/core/protocol.ts`) and the reference receiver
(`examples/protocol/validate.ts`). Both run these files on every test run, and a
case fails if either implementation disagrees with it.
