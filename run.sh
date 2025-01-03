#!/bin/bash

# Переходим в директорию с приложением
cd "$HOME/neomovies-api"

# Запускаем приложение
PORT=$PORT GIN_MODE=release ./app
