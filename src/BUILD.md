Build three3d.js from source:
  npm i three@0.186.1 esbuild@0.24.2
  npx esbuild src/three3d.src.js --bundle --format=esm --minify --target=es2019,safari14 --legal-comments=eof --outfile=three3d.js
