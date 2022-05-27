# SAF-TAC Crash Report System

## Deployment (Collector Only)

Use Docker,

    docker compose up

OR

After installing Node.js (with npm) in your system,

    npm i
    node .

## Deployment (Full CRS Functionality)

Use Docker,

    docker compose -f .\docker-compose.crs.yml up

OR

After installing Node.js (with npm) and MongoDB** in your system,

    npm i
    node .
**You may need to set a HOST name record for mongodb->localhost
