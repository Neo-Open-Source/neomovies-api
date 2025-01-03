#!/bin/bash

# Очищаем кэш Go
rm -rf $HOME/go/pkg/*
rm -rf $HOME/.cache/go-build/*

# Удаляем временные файлы
rm -f go1.21.5.linux-amd64.tar.gz
rm -rf $HOME/go/src/*

# Очищаем ненужные файлы в проекте
rm -rf vendor/
rm -f app
