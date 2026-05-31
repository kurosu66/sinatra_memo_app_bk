"""
ディズニーアプリのAPIトラフィックをキャプチャするmitmproxyスクリプト
使い方: mitmdump -s capture_disney_api.py --listen-port 8080

キャプチャ結果は disney_captured.json に保存されます。
"""

import json
import os
from datetime import datetime
from mitmproxy import http

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "disney_captured.json")

# キャプチャ対象のキーワード（ディズニー系ドメイン）
TARGET_KEYWORDS = [
    "tokyodisneyresort",
    "disney",
    "tdl",
    "tdr",
    "oriental",
    "olc",
]

captured = []


def matches_target(url: str) -> bool:
    url_lower = url.lower()
    return any(kw in url_lower for kw in TARGET_KEYWORDS)


def response(flow: http.HTTPFlow) -> None:
    url = flow.request.pretty_url

    if not matches_target(url):
        return

    try:
        req_body = flow.request.text or ""
    except Exception:
        req_body = "(binary)"

    try:
        res_body = flow.response.text or ""
    except Exception:
        res_body = "(binary)"

    entry = {
        "timestamp": datetime.now().isoformat(),
        "method": flow.request.method,
        "url": url,
        "path": flow.request.path,
        "request_headers": dict(flow.request.headers),
        "request_body": req_body,
        "status_code": flow.response.status_code,
        "response_headers": dict(flow.response.headers),
        "response_body": res_body,
    }

    captured.append(entry)

    # ファイルに追記保存
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(captured, f, ensure_ascii=False, indent=2)

    print(f"[CAPTURED] {flow.request.method} {url} -> {flow.response.status_code}")

    # 予約・認証関連のリクエストを強調表示
    keywords = ["login", "auth", "book", "reserve", "standby", "attract", "facility"]
    if any(kw in url.lower() for kw in keywords):
        print(f"  *** 重要リクエスト検出: {flow.request.method} {flow.request.path} ***")
        print(f"  リクエストボディ: {req_body[:500]}")
        print(f"  レスポンス: {res_body[:500]}")
