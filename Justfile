dev:
  go run ./cmd

dev-race:
  go run -race ./cmd

build:
  go build -o bin/simulator ./cmd

clean:
  rm -rf bin/simulator

vet:
  go vet ./...

fmt:
  go fmt ./...

release:
  go build -ldflags="-s -w" -o bin/simulator ./cmd
