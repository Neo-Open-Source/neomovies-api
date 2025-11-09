FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

RUN git clone https://gitlab.com/foxixus/neomovies-api .

RUN go mod download
RUN go build -o neomovies main.go

FROM alpine:3.22

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /app/neomovies .

EXPOSE 3000

CMD ["./neomovies"]
