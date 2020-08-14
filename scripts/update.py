#!/usr/bin/env python3

'''
To be run by cron, etc.

Downloads the hydrological station list from Environment Canada each day, applies updates to a spatial table.

Downloads the hydrological records for each station each day and updates a table of records (level, discharge).
'''

import os
import zipfile
import urllib.request
import psycopg2
import csv
import re
from dateutil import parser

station_url = 'https://dd.weather.gc.ca/hydrometric/doc/hydrometric_StationList.csv'
reading_url = 'https://dd.weather.gc.ca/hydrometric/csv/{prov}/daily/{prov}_{id}_daily_hydrometric.csv'
ddl_create = [
    'create table if not exists readings (rid serial primary key, id text, readtime timestamp, level float, discharge float)',
    "create table if not exists stations (sid serial primary key, id text, name text, prov text, timezone float, lastupdate timestamp, geom geometry('point', 4326))",
]
ddl_delete = [
    'drop table if exists readings',
    'drop table if exists stations'
]
ddl_create_indexes = [
    'create index if not exists readings_id_idx on readings(id)',
    'create index if not exists readings_readtime_idx on readings(readtime)',
    'create index if not exists stations_id_idx on stations(id)',
    'create index if not exists stations_geom_idx on stations using gist(geom)',
    'create index if not exists trgm_stations_name on stations using gist(name gist_trgm_ops)'
]
ddl_delete_indexes = [
    'drop index if exists readings_id_idx',
    'drop index if exists readings_readtime_idx',
    'drop index if exists stations_id_idx',
    'drop index if exists stations_geom_idx',
    'drop index if exists trgm_stations_name'
]
canvec_url = 'http://ftp.maps.canada.ca/pub/nrcan_rncan/vector/canvec/shp/Hydro/canvec_50K_{prov}_Hydro_shp.zip'
prov_list = ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NL', 'PE', 'NS', 'YT', 'NT', 'NV']

canvec_dir = './canvec'
canvec_srid = 4269
wct = 'watercourses'
wbt = 'waterbodies'

pguser = 'rob'
db = 'hydro'

def download(url, filename):
    '''
    Download the file at the url and save it to the path.
    '''
    try:
        with open(filename, 'wb') as o:
            with urllib.request.urlopen(url) as f:
                while True:
                    try:
                        chunk = f.read(16 * 1024)
                        if not chunk:
                            break
                        o.write(chunk)
                    except Exception as e:
                        print(e)
        return True
    except:
        return False

def create_indices(delete = False):
    '''
    Delete and create the indices for th time series database.
    '''

    conn = psycopg2.connect('dbname={db} user={pguser}'.format(db = db, pguser = pguser))

    try:
        with conn:
            with conn.cursor() as cur:

                for sql in ddl_create_indexes:
                    cur.execute(sql)

                cur.execute('commit')
                cur.execute('vacuum analyze')
    finally:
        conn.close()

def create_db(delete = False):
    '''
    Delete and create the tables for th time series database.
    '''

    conn = psycopg2.connect('dbname={db} user={pguser}'.format(db = db, pguser = pguser))

    try:
        with conn:
            with conn.cursor() as cur:

                if delete:
                    for sql in ddl_delete:
                        cur.execute(sql)

                for ddl in ddl_create:
                    cur.execute(ddl)

                for sql in ddl_create_indexes:
                    cur.execute(sql)

                cur.execute('commit')
                cur.execute('vacuum analyze')
    finally:
        conn.close()


def create_geometries(overwrite = False):
    '''
    Download the canvec hydrology data and build a spatial database.
    '''

    if not os.path.exists(canvec_dir):
        try:
            os.makedirs(canvec_dir)
        except: pass

    for prov in prov_list:

        url = canvec_url.format(prov = prov)
        fn = os.path.join(canvec_dir, '{}_{}'.format(prov, os.path.basename(url)))

        # Download and save the file.
        if overwrite or not os.path.exists(fn):
            download(url, fn)

        zdir = os.path.join(canvec_dir, prov)
        with zipfile.ZipFile(fn, 'r') as z:
            z.extractall(zdir)

        fwc = [x for x in os.listdir(zdir) if x.lower().endswith('.shp') and (x.lower().startswith('watercourse'))]
        fwb = [x for x in os.listdir(zdir) if x.lower().endswith('.shp') and (x.lower().startswith('watercourse'))]

        # Create the tables and load the geometries.
        for flst, table in ((fwc, wct), (fwb, wbt)):
            mode = '-d'
            for f in flst:
                os.system('shp2sql {mode} -s {srid} {file} {table}|psql -U {pguser} -d {db}'.format(srid = canvec_srid, table = table, file = f, pguser = pguser, db = db, mode = mode))
                mode = '-a'

        # Build indices on tables.
        for t in [wct, wbt]:
            os.system('psql -U {pguser} -d {db} -c "create index {table}_geom_idx on {table} using gist(geom)'.format(pguser = pguser, db = db, table = t))
            os.system('psql -U {pguser} -d {db} -c "create index {table}_name_en_idx on {table} using gist(name_en pg_tgrm_ops)'.format(pguser = pguser, db = db, table = t))
            os.system('psql -U {pguser} -d {db} -c "create index {table}_name_fr_idx on {table} using gist(name_fr pg_tgrm_ops)'.format(pguser = pguser, db = db, table = t))


def parse_tz(tz):
    '''
    Parse the timezone into a float (hours).
    '''
    h, m = list(map(float, tz[3:].split(':')))
    return h + m / 60.

lw = set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'near', 'of', 'on', 'onto', 'to', 'with'])

def repl(txt):
    txt = txt[0]
    txt = txt.lower()
    if not txt in lw:
        txt = txt[0].upper() + txt[1:]
    return txt

def sentence_case(txt):
    txt = re.sub(r'\w\S*', repl, txt)
    txt = txt[0].upper() + txt[1:]
    return txt

def update_stations():
    '''
    Update the database with the stations.
    Columns:  ID    Name / Nom  Latitude    Longitude   Prov/Terr   Timezone / Fuseau horaire
    '''
    create_db()

    conn = psycopg2.connect('dbname={db} user={pguser}'.format(db = db, pguser = pguser))

    try:
        with conn:
            with conn.cursor() as cur:

                print('Downloading stations file.')
                tmpfile = '/tmp/stations.csv'
                if not download(station_url, tmpfile):
                    return False

                with open(tmpfile, 'r+') as f:
                    rows = csv.reader(f)
                    next(rows)
                    for id, name, lat, lon, prov, tz in rows:
                        try:
                            tz = parse_tz(tz)
                            name = sentence_case(name)
                            print(name)
                            geom = 'POINT({} {})'.format(float(lon), float(lat))
                            cur.execute('select sid from stations where id=%s', (id,))
                            rows = cur.fetchall()
                            if len(rows) == 0:
                                print('Adding station', id, name)
                                cur.execute('insert into stations (id, name, prov, timezone, geom) values (%s, %s, %s, %s, st_geomfromtext(%s, 4326))',
                                    (id, name, prov, tz, geom)
                                )
                            else:
                                print('Updating station', id, name)
                                cur.execute('update stations set name=%s, prov=%s, timezone=%s, geom=st_geomfromtext(%s, 4326) where id=%s',
                                    (name, prov, tz, geom, id)
                                )
                        except Exception as e:
                            print(e)
    finally:
        conn.close()

def update_readings():
    '''
    Update the database with the newest readings.
    Columns: ID Date    Water Level / Niveau d'eau (m)  Grade   Symbol / Symbole    QA/QC   Discharge / Débit (cms) Grade   Symbol / Symbole    QA/QC
    '''
    create_db()

    conn = psycopg2.connect('dbname={db} user={pguser}'.format(db = db, pguser = pguser))

    try:
        with conn:

            stations = None
            with conn.cursor() as cur:

                print('Find stations and last updates.')
                cur.execute('select distinct id, prov, lastupdate from stations where prov is not null order by prov, id')
                stations = cur.fetchall()

                for id, prov, lastupdate in stations:

                    if not len(prov.strip()):
                        continue

                    tmpfile = '/tmp/readings.csv'
                    url = reading_url.format(prov = prov, id = id)
                    print('Downloading', url)
                    if not download(url, tmpfile):
                        print('Failed to download', url)
                        continue

                    items = []
                    lrt = None
                    with open(tmpfile, 'r') as f:
                        rows = csv.reader(f)
                        next(rows)
                        for id, date, level, g1, s1, qa1, discharge, g2, s2, qa2 in rows:
                            rt = parser.parse(date, ignoretz = True)

                            # If there's a lastupdate, skip records before it.
                            if lastupdate is not None and rt <= lastupdate:
                                continue
                            # Update the maximum update read time.
                            if lrt is None or rt > lrt:
                                lrt = rt
                            # Parse the level.
                            try:
                                level = float(level)
                            except:
                                level = -9999.
                            # Parse the discharge.
                            try:
                                discharge = float(discharge)
                            except:
                                discharge = -9999.

                            items.append((id, date, level, discharge))

                    print('Inserting', len(items), 'items.')
                    if len(items):
                        args = b','.join(cur.mogrify('(%s, timestamp with time zone %s, %s, %s)', item) for item in items)
                        cur.execute('insert into readings (id, readtime, level, discharge) values ' + args.decode())
                        cur.execute('update stations set lastupdate=%s where id=%s', (lrt, id))
                    cur.execute('commit')
                    cur.execute('begin')

                cur.execute('rollback')

    finally:
        conn.close()

if __name__ == '__main__':

    #create_db()
    #create_geometries()
    #update_stations()
    update_readings()
    create_indices()

