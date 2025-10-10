package simulation

import (
	"context"
	"time"

	"go.starlark.net/starlark"
)

// Request data structure
type Request struct {
	Id        string
	ClientId  string
	Data      string
	Timestamp time.Time
	Meta      *starlark.Dict
}

// Response data structure
type Response struct {
	Id        string
	Ok        bool
	Data      string
	Error     string
	Timestamp time.Time
}

// SleepWithContext sleeps for the specified duration, or returns an error if given context is cancelled
func SleepWithContext(ctx context.Context, duration time.Duration) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(duration):
		return nil
	}
}

// CurveFunction returns a closure that computes y for a given x using the provided control points and bounds.
// Implements the same interpolation logic as the frontend's mixedPath (Photoshop-like curves).
func CurveFunction(minX, maxX, minY, maxY float64, points []BehaviorPoint) func(x float64) float64 {
	// Defensive: must have at least two points
	if len(points) < 2 {
		return func(x float64) float64 {
			return minY
		}
	}

	// Helper: normalize x to [0,1]
	normX := func(x float64) float64 {
		if maxX == minX {
			return 0
		}
		return (x - minX) / (maxX - minX)
	}
	// Helper: denormalize y from [0,1] to [minY,maxY]
	denormY := func(y float64) float64 {
		return minY + y*(maxY-minY)
	}

	return func(x float64) float64 {
		nx := normX(x)
		// Clamp to [0,1]
		if nx <= points[0].X {
			return denormY(points[0].Y)
		}
		if nx >= points[len(points)-1].X {
			return denormY(points[len(points)-1].Y)
		}

		// Find segment
		var i int
		for i = 1; i < len(points); i++ {
			if nx < points[i].X {
				break
			}
		}
		prev := points[i-1]
		curr := points[i]
		dx := curr.X - prev.X
		if dx == 0 {
			return denormY(curr.Y)
		}
		t := (nx - prev.X) / dx

		// If either endpoint is a break, use linear interpolation
		if prev.Type == Break || curr.Type == Break {
			y := prev.Y + t*(curr.Y-prev.Y)
			return denormY(y)
		}

		// Both are curve: monotonic cubic interpolation (Fritsch-Carlson)
		// Estimate tangents
		var mPrev, mCurr float64
		if i-2 >= 0 {
			mPrev = (curr.Y - points[i-2].Y) / (curr.X - points[i-2].X)
		} else {
			mPrev = (curr.Y - prev.Y) / (curr.X - prev.X)
		}
		if i+1 < len(points) {
			mCurr = (points[i+1].Y - prev.Y) / (points[i+1].X - prev.X)
		} else {
			mCurr = (curr.Y - prev.Y) / (curr.X - prev.X)
		}
		// Clamp tangents for monotonicity
		if (curr.Y-prev.Y) == 0 || (mPrev != 0 && (sign(mPrev) != sign(curr.Y-prev.Y))) {
			mPrev = 0
		}
		if (curr.Y-prev.Y) == 0 || (mCurr != 0 && (sign(mCurr) != sign(curr.Y-prev.Y))) {
			mCurr = 0
		}

		// Cubic Hermite interpolation
		y := cubicHermite(prev.Y, curr.Y, mPrev*dx, mCurr*dx, t)
		// Clamp to [0,1]
		if y < 0 {
			y = 0
		}
		if y > 1 {
			y = 1
		}
		return denormY(y)
	}
}

// sign returns the sign of a float64 (-1, 0, 1)
func sign(x float64) int {
	if x > 0 {
		return 1
	}
	if x < 0 {
		return -1
	}
	return 0
}

// cubicHermite performs cubic Hermite interpolation
func cubicHermite(y0, y1, m0, m1, t float64) float64 {
	t2 := t * t
	t3 := t2 * t
	return (2*t3-3*t2+1)*y0 + (t3-2*t2+t)*m0 + (-2*t3+3*t2)*y1 + (t3-t2)*m1
}
