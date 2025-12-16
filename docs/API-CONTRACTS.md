# API Contracts (V1)

Base URL: `/v1`

All successful responses are wrapped in a standard envelope:
```json
{
  "data": { ... },
  "meta": {
    "version": "v1",
    "status": "ok"
  }
}
```

All error responses follow this format:
```json
{
  "error": {
    "code": 400,
    "message": "Error description",
    "request_id": "uuid...",
    "detail": { ... }
  }
}
```

---

## Analyses

### POST /v1/analyses
Submit an SGF for full analysis (blocking).

**Request:**
```json
{
  "sgf": "(;GM[1]FF[4]SZ[19];B[pd];W[dp]...)",
  "visits": 1000,
  "start_turn": 0,
  "end_turn": 10
}
```

| Field       | Type   | Required | Default | Description                    |
|-------------|--------|----------|---------|--------------------------------|
| sgf         | string | Yes      | -       | Raw SGF content                |
| visits      | int    | No       | 1000    | Analysis depth (100-100000)    |
| start_turn  | int    | No       | -       | Start turn index (inclusive)   |
| end_turn    | int    | No       | -       | End turn index (inclusive)     |

**Response:**
```json
{
  "data": {
    "sgf": "(;GM[1]FF[4]SZ[19]...C[winrate:50.0 score:0.5]...)",
    "visits_used": 1000,
    "engine_time_sec": 1.5
  },
  "meta": { "version": "v1", "status": "ok" }
}
```

**curl Example:**
```bash
curl -X POST http://localhost:8000/v1/analyses \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"sgf": "(;GM[1]FF[4]SZ[19];B[pd];W[dp])", "visits": 1000}'
```

---

### POST /v1/analyses/stream
Stream analysis results via Server-Sent Events (SSE).

**Request:**
```json
{
  "sgf": "(;GM[1]FF[4]SZ[19];B[pd];W[dp]...)",
  "visits": 1000,
  "start_turn": 0,
  "end_turn": 50
}
```

**Response:** `Content-Type: text/event-stream`

Progress Event (per turn):
```
data: {"turn": 5, "total": 50, "winrate": 52.3, "score": 1.5, "currentPlayer": "B", "topMoves": [...]}
```

| Field          | Type   | Description                          |
|----------------|--------|--------------------------------------|
| turn           | int    | Current turn number (1-indexed)      |
| total          | int    | Total turns being analyzed           |
| winrate        | float  | Win probability (0-100)              |
| score          | float  | Score lead (positive = Black ahead)  |
| currentPlayer  | string | "B" or "W"                           |
| topMoves       | array  | Top move suggestions                 |

Completion Event:
```
data: {"done": true}
```

Error Event:
```
data: {"error": "Error message"}
```

**curl Example:**
```bash
curl -X POST "http://localhost:8000/v1/analyses/stream" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  --no-buffer \
  -d '{"sgf": "(;GM[1]SZ[19];B[pd];W[dp])", "visits": 500}'
```

**JavaScript Example:**
```javascript
const EventSource = require('react-native-sse').default;

const es = new EventSource('/v1/analyses/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-key' },
  body: JSON.stringify({ sgf: sgfContent, visits: 1000 }),
});

es.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.done) { es.close(); return; }
  updateProgress(data.turn, data.total);
});
```

---

## Recognitions

### POST /v1/recognitions
Upload an image to detect the board and classify stones.

**Request:** `multipart/form-data`

| Field      | Type    | Required | Default | Description                    |
|------------|---------|----------|---------|--------------------------------|
| image      | File    | Yes      | -       | Go board image (jpg, png)      |
| board_size | int     | No       | 19      | Board size (9, 13, or 19)      |
| use_ml     | boolean | No       | true    | Use ML model (ResNet9)         |

**Response:**
```json
{
  "data": {
    "sgf": "(;GM[1]SZ[19]AB[pd][dp]AW[dd][pp])",
    "boardSize": 19,
    "confidence": 0.95,
    "blackStones": 15,
    "whiteStones": 14,
    "method": "universal",
    "board": [[0,1,0,...], ...],
    "corners": [[100,100], [500,100], [500,500], [100,500]],
    "warpedImageBase64": null
  },
  "meta": { "version": "v1", "status": "ok" }
}
```

| Field             | Type    | Description                                     |
|-------------------|---------|-------------------------------------------------|
| sgf               | string  | Recognized board position as SGF                |
| boardSize         | int     | Detected/specified board size                   |
| confidence        | float   | Recognition confidence (0-1)                    |
| blackStones       | int     | Number of detected black stones                 |
| whiteStones       | int     | Number of detected white stones                 |
| method            | string  | "universal" (ML) or "opencv" (fallback)         |
| board             | 2D int  | Board state: 0=empty, 1=black, 2=white          |
| corners           | array   | Detected corner coordinates [[x,y], ...]        |
| warpedImageBase64 | string  | Base64 warped image (only for /classify)        |

---

### POST /v1/recognitions/corners
Detect grid corners for manual adjustment (Step 1 of 2-step recognition).

**Request:** `multipart/form-data`
- `image`: File

**Response:**
```json
{
  "data": {
    "corners": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]],
    "imageWidth": 1080,
    "imageHeight": 1920,
    "previewBase64": "..."
  },
  "meta": { "version": "v1", "status": "ok" }
}
```

---

### POST /v1/recognitions/classify
Classify stones using user-provided corners (Step 2 of 2-step recognition).

**Request:** `multipart/form-data`

| Field      | Type   | Required | Description                            |
|------------|--------|----------|----------------------------------------|
| image      | File   | Yes      | Go board image                         |
| corners    | string | Yes      | JSON array: `[[x1,y1], [x2,y2], ...]`  |
| board_size | int    | No       | Board size (default: 19)               |

Corner order: top-left, top-right, bottom-right, bottom-left.

**Response:** Same as `/v1/recognitions`

---

## Health

### GET /health
Global health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "dependencies": {
    "katago": "running"
  }
}
```

### GET /v1/health
v1-specific health check with KataGo status.

---

## Authentication

All endpoints require an API key when `REQUIRE_API_KEY=true`.

**Header:**
```
X-API-Key: your-api-key
```

---

## Error Codes

| Code | Description                                      |
|------|--------------------------------------------------|
| 400  | Invalid request (malformed SGF, missing fields)  |
| 401  | Missing or invalid API key                       |
| 422  | Unprocessable entity (board detection failed)    |
| 429  | Rate limit exceeded (see Retry-After header)     |
| 500  | Internal server error                            |
| 502  | KataGo engine error                              |
| 504  | Analysis timeout                                 |

---

## RunPod Serverless

### Endpoint
`POST https://<pod-id>.runpod.io/runsync`

### Headers
- `Authorization: Bearer <RUNPOD_API_KEY>`
- `X-Worker-Key: <KATAGO_API_KEY>` (optional)

### Request
```json
{
  "input": {
    "sgf_data": "(;GM[1]FF[4]SZ[19];B[pd];W[dp]...)",
    "steps": 1000,
    "start_turn": 0,
    "end_turn": 10
  }
}
```

### Response
```json
{
  "output": {
    "analyzed_sgf": "(;GM[1]FF[4]SZ[19]...C[winrate:50.0 score:0.5]...)"
  }
}
```
