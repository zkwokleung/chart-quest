---
name: Level content
about: Author or revise a level
title: 'Author level X.Y — <title>'
labels: 'type:content, area:content'
---

## Level

- **ID:** `X.Y`
- **Chapter:** 
- **Kind:** <!-- one of the ten in docs/ARCHITECTURE.md §1 -->
- **Series + bar range:** 

## What it teaches

<!-- One sentence. If you can't say it in one, the level is mis-scoped. -->

## Brief shown to the player

<!-- One or two sentences, max. This is what appears on screen. -->

## Reference answer

<!-- The target, and what tolerance is reasonable -->

## Misconceptions (minimum 2 — required)

Each needs a `test` you can actually write. If you can't write the test, the misconception is too vague.

1. **id:** `` — **message:** 
2. **id:** `` — **message:** 

Good messages name the specific error in *this* attempt and give the why in one clause. Bad ones restate the lesson or paraphrase the score. See `docs/AUTHORING.md`.

## Checklist

- [ ] ≥2 misconceptions, each with a writable `test`
- [ ] Reference answer scores 3 stars through its own grader
- [ ] Star thresholds authored loose (calibration happens after M5)
- [ ] Does 3 stars require the *skill*, not just patience with the tolerance?
- [ ] Any claim about a pattern working is backed by `base-rates.json`
- [ ] Brief is under three sentences
