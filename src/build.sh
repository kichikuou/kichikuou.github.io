#!/bin/sh
set -e

if [ ! -f typings/tsd.d.ts ]; then
  tsd install
fi
tsc
