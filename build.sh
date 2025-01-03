#!/bin/bash

# Переходим в директорию с приложением
cd "$HOME/neomovies-api"

# Собираем приложение
go build -o app
