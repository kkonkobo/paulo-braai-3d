#!/bin/sh
# usage: shoot.sh <page> <out.png> [query] [WxH]
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size=${4:-1500,900} --virtual-time-budget=7000 --screenshot="$2" \
  "file://$PWD/docs/$1?$3" 2>/dev/null
