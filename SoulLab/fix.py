import os

with open("index.html", "r", encoding="utf-8") as f:
    data = f.read()

# Fix common string escapes we saw in the HTML
data = data.replace('\\"', '"')
data = data.replace('\\\\"', '"')

# Fix malformed html lang tag
data = data.replace('<html lang="\\"zh-CN\\">', '<html lang="zh-CN">')
data = data.replace('<html lang=\\""zh-CN\\">', '<html lang="zh-CN">')

with open("index.html", "w", encoding="utf-8") as f:
    f.write(data)
