# API spend

One row per run that called a paid API. Counts only, never post text. Prices: claude.com/pricing (fetched 2026-10-04).
Caps: $5 per run, $20 total. "Actual" is computed from the API's reported usage.

| Date | Model | Prompt version | Items | Input tokens | Output tokens | Estimated cost | Actual cost | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 | claude-haiku-4-5-20251001 | judge-v2 | 3 | 6055 | 1311 | $0.0273 | $0.0126 | eval --limit 3 |
| 2026-10-04 | claude-haiku-4-5-20251001 | judge-v2 | 77 | 145476 | 32508 | $0.6876 | $0.3080 | eval |
| 2026-10-04 | claude-sonnet-5-5 | judge-v2 | 80 | 160962 | 43956 | $1.4296 | $0.7615 | eval |
| 2026-10-04 | claude-sonnet-5-5 | judge-v2 | 14 | 32230 | 12111 | $0.2467 | $0.1856 | eval |
| 2026-10-04 | claude-sonnet-5-5 | judge-v2 | 3 | 6586 | 4214 | $0.0972 | $0.0553 | eval |
| 2026-10-04 | claude-sonnet-5-5 | judge-v2 | 1 | 2407 | 3000 | $0.0329 | $0.0348 | eval |
| 2026-10-04 | claude-sonnet-5-5 | judge-v2.1 | 80 | 199192 | 80497 | $2.6440 | $1.2034 | eval |
| 2026-10-04 | claude-sonnet-5-5 | judge-v2.1 | 1 | 2425 | 3000 | $0.0350 | $0.0348 | diagnose max_tokens |
| 2026-10-04 | claude-sonnet-5-5 | judge-v2.1 | 11 | 32467 | 8260 | $0.3657 | $0.1475 | eval |
| 2026-10-04 | claude-sonnet-5-5 | judge-v2.1 | 3 | 8107 | 1764 | $0.2580 | $0.0339 | test: thinking adaptive, effort medium |
| 2026-10-04 | claude-sonnet-5-5 | judge-v2.2 | 80 | 230392 | 62502 | $3.4440 | $1.0858 | eval |
| 2026-10-05 | claude-sonnet-5-5 | judge-v2.1 | 190 | 515231 | 119223 | $3.7467 | $2.2227 | scout |
