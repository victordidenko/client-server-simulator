# Simple retry strategy: retry up to 5 times on any error/fail
#
# - Basic retry mechanism with up to 5 attempts
# - No delay between retries
# - Good for understanding baseline retry behavior


MAX_RETRIES = 5
DEFAULT_HTTP_TIMEOUT = 10000


def on_request(req):
    if "retry_count" not in req["meta"]:
        req["meta"]["retry_count"] = 0

    return {"allow": True, "delay": 0, "timeout": DEFAULT_HTTP_TIMEOUT}


def on_retry(req, resp, err):
    if req["meta"]["retry_count"] < MAX_RETRIES:
        req["meta"]["retry_count"] += 1

        # Immediate retry, no delay
        return {"allow": True, "delay": 0}

    # Stop further retries
    return {"allow": False, "delay": 0}
