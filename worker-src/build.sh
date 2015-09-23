#!/bin/sh
set -e

if [ ! -f typings/tsd.d.ts ]; then
  tsd install
fi
if [ ! -f typings/lib.core.d.ts ]; then
  wget -P typings https://raw.githubusercontent.com/Microsoft/TypeScript/master/lib/lib.core.d.ts
fi
if [ ! -f typings/lib.webworker.d.ts ]; then
  wget -P typings https://raw.githubusercontent.com/Microsoft/TypeScript/master/lib/lib.webworker.d.ts
fi
tsc
