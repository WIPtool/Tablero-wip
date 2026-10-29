# Tablero WIP: facturas de MongoDB Atlas a Supabase (fuente: tablero-wip/aws/facturas_atlas.py)
import base64
import datetime
import json
import urllib.request

import boto3

SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co'
ORG = '62f2bbc72834d50bd9515f12'
API = 'https://cloud.mongodb.com/api/atlas/v2/orgs/' + ORG
JSONV = 'application/vnd.atlas.2023-01-01+json'

def pedir(url, metodo='GET', datos=None, cab=None):
    req = urllib.request.Request(url, data=datos, method=metodo, headers=cab or {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def handler(event, context):
    s = json.loads(boto3.client('secretsmanager').get_secret_value(SecretId='tablero-wip')['SecretString'])
    k = s['supabase_secret_key misha@wiptool.com']
    if not s.get('atlas_client_id') or not s.get('atlas_client_secret'):
        return {'pendiente': 'faltan atlas_client_id y atlas_client_secret en el secreto tablero-wip'}
    def sb(ruta, cuerpo, extra=None):
        return pedir(SUPABASE + ruta, 'POST', json.dumps(cuerpo).encode(), {'apikey': k, 'Content-Type': 'application/json', **(extra or {})})
    try:
        basic = base64.b64encode((s['atlas_client_id'] + ':' + s['atlas_client_secret']).encode()).decode()
        tok = json.loads(pedir('https://cloud.mongodb.com/api/oauth/token', 'POST', b'grant_type=client_credentials',
                               {'Authorization': 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'}))['access_token']
        A = {'Authorization': 'Bearer ' + tok, 'Accept': JSONV}
        lista = json.loads(pedir(API + '/invoices?itemsPerPage=500', cab=A))['results']
        limite = (datetime.date.today() - datetime.timedelta(days=int((event or {}).get('dias', 100)))).isoformat()
        facturas, movs = [], []
        for f in lista:
            if f['endDate'][:10] < limite:
                continue
            d = json.loads(pedir(API + '/invoices/' + f['id'], cab=A))
            csv = pedir(API + '/invoices/' + f['id'], cab={**A, 'Accept': 'application/vnd.atlas.2023-01-01+csv'})
            arch = 'mongodb/%s/%s.csv' % (ORG, f['id'])
            pedir(SUPABASE + '/storage/v1/object/facturas/' + arch, 'POST', csv, {'apikey': k, 'x-upsert': 'true', 'Content-Type': 'text/csv'})
            facturas.append({'id': 'mongodb:' + f['id'], 'proveedor': 'mongodb', 'cuenta': 'Aplicando', 'numero': f['id'],
                             'fecha': d['endDate'][:10], 'periodo': d['startDate'][:7], 'monto': (d.get('amountBilledCents') or 0) / 100,
                             'moneda': 'USD', 'archivo_csv': arch, 'correo_url': 'https://cloud.mongodb.com/v2#/org/%s/billing/invoice/%s' % (ORG, f['id']),
                             'estado': d.get('statusName', '')})
            for p in d.get('payments') or []:
                e = p.get('statusName', '')
                if e in ('PAID', 'FAILED'):
                    movs.append({'id': 'mongodb:' + p['id'], 'proveedor': 'mongodb', 'cuenta': 'Aplicando', 'fecha': (p.get('updated') or p['created'])[:10],
                                 'tipo': 'pago' if e == 'PAID' else 'rechazo', 'monto': (p.get('amountPaidCents') or p.get('amountBilledCents') or 0) / 100,
                                 'moneda': 'USD', 'detalle': '', 'correo_url': ''})
        P = {'Prefer': 'resolution=merge-duplicates,return=minimal'}
        if facturas:
            sb('/rest/v1/proveedor_factura?on_conflict=id', facturas, P)
        if movs:
            sb('/rest/v1/proveedor_movimiento?on_conflict=id', movs, P)
        sb('/rest/v1/rpc/registrar_carga', {'p_fuente': 'mongodb', 'p_filas': len(facturas)})
        return {'facturas': len(facturas), 'pagos': len(movs)}
    except Exception as e:
        sb('/rest/v1/rpc/registrar_error', {'p_fuente': 'mongodb', 'p_mensaje': str(e)[:400]})
        raise
