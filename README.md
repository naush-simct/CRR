# Deployment

git clone https://github.com/naush-simct/CRR.git --depth=1

sudo apt install nodejs
sudo apt install npm
npm install forever -g

cd CRR
npm i
forever start index.js
