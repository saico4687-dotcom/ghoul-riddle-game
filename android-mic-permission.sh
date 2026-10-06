#!/bin/sh
# شغّله من جذر المشروع: sh android-mic-permission.sh  (آمن لو اتشغل أكتر من مرة)
M=android/app/src/main/AndroidManifest.xml
[ -f "$M" ] || { echo "مش لاقي $M"; exit 1; }
for P in RECORD_AUDIO MODIFY_AUDIO_SETTINGS; do
  if grep -q "android.permission.$P" "$M"; then echo "$P موجود"; else
    sed -i "0,/<application/s//<uses-permission android:name=\"android.permission.$P\" \/>\n    <application/" "$M" && echo "اتضاف $P"
  fi
done
