# Exponential backoff retry strategy: delay increases exponentially
#
# - Implements exponential backoff with configurable parameters
# - Reduces server load by spacing out retries
# - Prevents immediate retry storms


MAX_RETRIES = 5
DEFAULT_HTTP_TIMEOUT = 10000
INTERVAL_MILLIS = 500  # 0.5 sec                 # The amount of milliseconds to exponentially increase
BACKOFF_FACTOR = 2                               # The factor to backoff by
BACKOFF_LIMIT_MILLIS = 10 * 60 * 1000  # 10 min  # The maximum milliseconds to increase to


def calculate_backoff_millis(count):
    # Calculate exponential base delay
    base = INTERVAL_MILLIS * int(pow(BACKOFF_FACTOR, count))

    # Ensure result is within bounds
    return min(BACKOFF_LIMIT_MILLIS, max(INTERVAL_MILLIS, base))


def on_request(req):
    if "retry_count" not in req["meta"]:
        req["meta"]["retry_count"] = 0

    return {"allow": True, "delay": 0, "timeout": DEFAULT_HTTP_TIMEOUT}


def on_retry(req, resp, err):
    if req["meta"]["retry_count"] < MAX_RETRIES:
        req["meta"]["retry_count"] += 1

        # Calculate backoff delay
        delay = calculate_backoff_millis(req["meta"]["retry_count"] - 1)

        return {"allow": True, "delay": delay}

    return {"allow": False, "delay": 0}
