package simulation

import (
	"encoding/json"
	"fmt"
)

// BehaviorPoint represents a point in the behavior curve
type BehaviorPoint struct {
	X    float64
	Y    float64
	Type BehaviorPointType
}

// BehaviorPointType defines the type of error point: curve or break
type BehaviorPointType int

const (
	Curve BehaviorPointType = iota
	Break
)

func (ept BehaviorPointType) String() string {
	switch ept {
	case Curve:
		return "curve"
	case Break:
		return "break"
	default:
		return "unknown"
	}
}

// MarshalJSON implements the json.Marshaler interface for ErrorPointType
func (ept BehaviorPointType) MarshalJSON() ([]byte, error) {
	return json.Marshal(ept.String())
}

// UnmarshalJSON implements the json.Unmarshaler interface for ErrorPointType
func (ept *BehaviorPointType) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	switch s {
	case "curve":
		*ept = Curve
	case "break":
		*ept = Break
	default:
		return fmt.Errorf("invalid ErrorPointType: %s", s)
	}
	return nil
}
