const fs = require("fs");
const mongoose = require("mongoose");
const tunnel = require("tunnel-ssh");
const csv = require('fast-csv');
const path = require('path');
let async = require('async');

let sshConfig = {
    username:'alonzo',
    host:'dev.aetheria.io',
    agent: process.env.SSH_AUTH_SOCK,
    privateKey:require('fs').readFileSync('~/.ssh/Aetheria.pri'),
    dstHost:'127.0.0.1',
    dstPort:27017,
    localHost:'127.0.0.1',
    localPort: 27017
}

let mongoConfig = {
    host: 'localhost',
    dbName: 'AllocationEvent',
    port: 27017
}

let mapConfig = {
    datumX: 62,
    datumY: 159
}

let getMapGrid = async () => {
    return new Promise((res, rej) => {
        let map = [];
        fs.createReadStream(path.resolve(__dirname, 'aetheria.csv'))
          .pipe(csv.parse({ headers: false }))
          .on('error', error => rej(err))
          .on('data', row => map.push(row))
          .on('end', () => res(map));
    });
}

let buildMapObject = (map) => {
    let mapObj = [];
    for (i = 0; i < map.length; i++)
    {
        for (j = 0; j < map[i].length; j++)
        {
            let plot = map[i][j].split('|')
            if(plot[0] == 'Aetheria') {
                mapObj.push({
                    addr: 'COMMUNITY_LAND',
                    p_type: 'community',
                    purpose: plot[1],
                    cords: {
                        x: 68-12+j,
                        y: 158-i
                    }
            })
            } else if (plot[0] == 'DCL' || plot[1] == undefined) {
                continue;
            } else {
                mapObj.push({
                    addr: plot[1],
                    p_type: 'alloc',
                    purpose: plot[2],
                    cords: {
                        x: 68-12+j,
                        y: 158-i
                    }
                })
            }
        }
    }
    return mapObj;
}

let mapUpload = async (db) => {
    let map = await getMapGrid();
    let objMap = buildMapObject(map);
    console.log("uploading Docs..")
    db.collection("Plots").insertMany(objMap, console.log);
}

let server = tunnel(sshConfig, (error, server) => {
    mongoose.connect(`mongodb://${mongoConfig.host}:${mongoConfig.port}/${mongoConfig.dbName}`);

    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'DB connection error:'));
    db.once('open', async () => {
        await mapUpload(db);
    });
});

server.on('error', console.error)
