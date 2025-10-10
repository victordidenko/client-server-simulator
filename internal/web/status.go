package web

import (
	"encoding/json"
)

// Status defines Dashboard status type
type Status int

// Define enum values
const (
	StatusNone Status = iota
	StatusRunning
	StatusStopped
)

// String method for readable output and JSON marshaling
func (s Status) String() string {
	switch s {
	case StatusNone:
		return "NONE"
	case StatusRunning:
		return "RUNNING"
	case StatusStopped:
		return "STOPPED"
	default:
		return "UNKNOWN"
	}
}

// MarshalJSON implements the json.Marshaler interface
func (s Status) MarshalJSON() ([]byte, error) {
	return json.Marshal(s.String())
}
