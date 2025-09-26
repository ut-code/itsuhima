# TODO: common のみに依存するようにする
cd ..
npm ci
cd server
npm run build
cd ../client

if [[ "$CF_PAGES_BRANCH" == "main" ]]; then
  npm run build
else
  npm run build:preview
fi
