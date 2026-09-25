with open('public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('\\\'', "'")

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
