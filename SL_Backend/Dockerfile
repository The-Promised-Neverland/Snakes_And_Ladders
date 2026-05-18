FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/server ./cmd/server

FROM alpine:3.22

WORKDIR /app

RUN adduser -D -H -u 10001 appuser

COPY --from=builder /out/server /app/server

ENV PORT=9090

EXPOSE 9090

USER appuser

ENTRYPOINT ["/app/server"]
