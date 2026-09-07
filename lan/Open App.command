#!/bin/bash
# NEWS MEVA - Open App (LAN)
# Opens the NEWS MEVA app on this Mac from the office LAN server.
# No admin needed, nothing to install - just a browser.
#
# Uses http://newsmeva when it actually works, otherwise falls back
# to the server IP directly. Change SERVER_IP below if it ever changes.

SERVER_IP="192.168.1.14"

CODE=$(curl -s -o /dev/null -m 3 -w '%{http_code}' "http://newsmeva" 2>/dev/null)
if [ "$CODE" = "200" ]; then
  open "http://newsmeva"
else
  open "http://$SERVER_IP:3002"
fi
