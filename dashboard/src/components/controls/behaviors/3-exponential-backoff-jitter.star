# Exponential backoff with bounded random jitter
#
# - Uses exponential backoff with a configurable base interval and factor
# - Adds bounded randomization (±20% by default) to prevent thundering herd
# - Ensures delay stays within configured bounds


MAX_RETRIES = 5
DEFAULT_HTTP_TIMEOUT = 10000
INTERVAL_MILLIS = 500  # 0.5 sec                 # The amount of milliseconds to exponentially increase
BACKOFF_FACTOR = 2                               # The factor to backoff by
BACKOFF_LIMIT_MILLIS = 10 * 60 * 1000  # 10 min  # The maximum milliseconds to increase to
RANDOM_FACTOR = 0.2                              # The percentage of backoff time to randomize by


def calculate_backoff_millis(count):
    # Calculate exponential base delay
    base = INTERVAL_MILLIS * int(pow(BACKOFF_FACTOR, count))

    # Add bounded jitter: ±(random_factor * base)
    # random() returns [0, 1), so (random() - 0.5) * 2 gives us [-1, 1)
    fuzz_range = RANDOM_FACTOR * base
    fuzz = int(fuzz_range * (random() - 0.5) * 2)

    result = base + fuzz

    # Ensure result is within bounds
    return min(BACKOFF_LIMIT_MILLIS, max(INTERVAL_MILLIS, result))


def on_request(req):
    if "retry_count" not in req["meta"]:
        req["meta"]["retry_count"] = 0

    return {"allow": True, "delay": 0, "timeout": DEFAULT_HTTP_TIMEOUT}


def on_retry(req, resp, err):
    if req["meta"]["retry_count"] < MAX_RETRIES:
        req["meta"]["retry_count"] += 1

        # Calculate backoff with bounded jitter
        delay = calculate_backoff_millis(req["meta"]["retry_count"] - 1)

        return {"allow": True, "delay": delay}

    return {"allow": False, "delay": 0}
