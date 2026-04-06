# Console Missing Command History And Export

The Console page streams logs, but it is still thin compared to operator needs.

Current gaps:

- no saved command history
- no export / copy full log action
- no structured error summary
- no visible distinction between the current process and previous runs

Why it matters:

- long-running upload operations need post-run inspection
- logs are often required to debug failed platform uploads

Expected outcome:

- better console session handling
- copy/export support
- stronger run summary metadata
