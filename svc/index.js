const express = require('express');
const app = express();
const port = 3000;

const { Pool, Client } = require('pg')
const pool = new Pool({
  user: 'rob',
  host: 'localhost',
  database: 'hydro',
  password: 'river',
  port: 5432,
})

const Service = require('./service.js');
const svc = new Service(pool);

app.use('/maps/hydro', express.static('../www'));

svc.configureApp(app, '/maps/hydro');
//svc.createDB();


app.listen(port, () => console.log('started'));
