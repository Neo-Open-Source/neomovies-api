#!/bin/bash

# Создаем директорию для сборки
BUILD_DIR="$HOME/build_tmp"
mkdir -p "$BUILD_DIR"

# Скачиваем и устанавливаем Go во временную директорию
curl -L https://go.dev/dl/go1.21.5.linux-amd64.tar.gz | tar -C "$BUILD_DIR" -xz

# Настраиваем переменные окружения для Go
export PATH="$BUILD_DIR/go/bin:$PATH"
export GOPATH="$BUILD_DIR/go_path"
export GOCACHE="$BUILD_DIR/go-build"
export GOMODCACHE="$BUILD_DIR/go-mod"

# Создаем необходимые директории
mkdir -p "$GOPATH"
mkdir -p "$GOCACHE"
mkdir -p "$GOMODCACHE"

# Собираем приложение с отключенным CGO и уменьшенным бинарником
cd "$HOME/neomovies-api"
CGO_ENABLED=0 go build -ldflags="-s -w" -o app

# Очищаем после сборки
rm -rf "$BUILD_DIR"
