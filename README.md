# sinatra_memo_app

A small Sinatra app with memos and Apple Health workout tracking.

## Setup

```
bundle install
bundle exec ruby bin/migrate.rb
bundle exec puma config.ru
```

## Apple Health integration

HealthKit itself is only accessible from iOS, so the integration point is an
import API that accepts the JSON produced by common export tools (e.g. the
"Health Auto Export" app, or a Shortcuts-based HealthKit export):

```
POST /api/workouts/import
Content-Type: application/json

{
  "data": {
    "workouts": [
      {
        "id": "<HealthKit UUID>",
        "name": "ランニング",
        "start": "2026-07-14 07:00:00 +0900",
        "duration": 1800,
        "activeEnergyBurned": { "qty": 260 },
        "avgHeartRate": { "qty": 145 },
        "distance": { "qty": 5.2 }
      }
    ]
  }
}
```

Records are deduplicated by the HealthKit `id`/`uuid`. A top-level
`{ "workouts": [...] }` array or a single workout object are also accepted.

Other endpoints:

- `GET /workouts` — history + a suggested next workout (web UI)
- `GET /api/workouts` — history as JSON
- `GET /api/workouts/suggestion` — suggested next workout as JSON

The suggestion logic (`lib/workout_suggester.rb`) looks at how recently and
how intensely you last worked out, how many workouts happened in the last 7
days, and rotates the workout type so the same one isn't suggested twice in a
row.

## Tests

```
RACK_ENV=test bundle exec rspec
```
