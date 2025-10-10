# Exponential backoff with jitter and retry budget
# Retry budget limits the ratio of retries to total requests over a time window
#
# - Limits retry ratio to 10% of total requests over a 1-minute sliding window
# - Prevents retry storms while allowing reasonable retry behavior
# - Includes minimum request threshold before budget enforcement


MAX_RETRIES = 5
DEFAULT_HTTP_TIMEOUT = 10000
INTERVAL_MILLIS = 500  # 0.5 sec                 # The amount of milliseconds to exponentially increase
BACKOFF_FACTOR = 2                               # The factor to backoff by
BACKOFF_LIMIT_MILLIS = 10 * 60 * 1000  # 10 min  # The maximum milliseconds to increase to
RANDOM_FACTOR = 0.2                              # The percentage of backoff time to randomize by

WINDOW_DURATION = 10000           # 10 seconds window
MAX_RETRY_RATIO = 0.1             # Max 10% of requests can be retries
MIN_REQUESTS_FOR_BUDGET = 20      # Need at least 20 requests before enforcing budget


def set_state():
    return {
        "window_start": 0,
        "total_requests": 0,
        "retry_attempts": 0
    }


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


def reset_budget_window():
    state = get_state()
    current_time = now()

    if state["window_start"] == 0:
        state["window_start"] = current_time

    # Reset window if it has expired
    if current_time - state["window_start"] > WINDOW_DURATION:
        state["window_start"] = current_time
        state["total_requests"] = 0
        state["retry_attempts"] = 0


def is_retry_allowed():
    state = get_state()

    if state["total_requests"] < MIN_REQUESTS_FOR_BUDGET:
        return True  # Always allow retries if we haven't reached minimum request count

    current_ratio = state["retry_attempts"] / state["total_requests"]
    return current_ratio < MAX_RETRY_RATIO


def on_request(req):
    state = get_state()
    reset_budget_window()

    # Initialize request metadata
    if "retry_count" not in req["meta"]:
        req["meta"]["retry_count"] = 0
        state["total_requests"] += 1  # Count this as an original request

    return {"allow": True, "delay": 0, "timeout": DEFAULT_HTTP_TIMEOUT}


def on_retry(req, resp, err):
    state = get_state()
    reset_budget_window()

    # Check retry budget first
    if not is_retry_allowed():
        current_ratio = state["retry_attempts"] / state["total_requests"]
        return {"allow": False, "delay": 0}

    if req["meta"]["retry_count"] < MAX_RETRIES:
        req["meta"]["retry_count"] += 1
        state["retry_attempts"] += 1

        # Calculate backoff with bounded jitter
        delay = calculate_backoff_millis(req["meta"]["retry_count"] - 1)

        return {"allow": True, "delay": delay}

    return {"allow": False, "delay": 0}
