# Lambda "tablero-facturas-aws" (cuenta 329792044951, us-east-1): carga las facturas de AWS en Operaciones › Gastos.
# Corre cada día a las 7 a. m. de Colombia (regla de EventBridge "tablero-facturas-aws-diario", cron(0 12 * * ? *) UTC).
# Lee las facturas con la API Invoicing (un mes por consulta), baja el PDF de cada una (enlace temporal de AWS), lo sube
# al bucket privado "facturas" de Supabase y guarda la fila en proveedor_factura. La clave de Supabase la toma del secreto
# "tablero-wip" de Secrets Manager en cada corrida (no queda en el código ni en variables).
#   Corrida normal: últimos 3 meses.  Histórico a mano: invocar con {"meses": 60}.
# Despliegue: pila de CloudFormation "tablero-facturas-aws" (función + regla diaria + permiso) con este código en línea
# (Code.ZipFile, archivo index.py, máx. 4.096 caracteres: se sube sin estas líneas de cabecera). Rol IAM aparte:
# "tablero-facturas-aws" (invoicing:ListInvoiceSummaries/GetInvoicePDF, GetSecretValue del secreto tablero-wip y
# AWSLambdaBasicExecutionRole). Para cambiar el código: UpdateStack con la plantilla o UpdateFunctionCode.
import datetime
import json
import urllib.request

import boto3

SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co'
SECRETO = 'tablero-wip'
CAMPO_CLAVE = 'supabase_secret_key misha@wiptool.com'


def pedir(url, metodo='GET', datos=None, cabeceras=None):
    req = urllib.request.Request(url, data=datos, method=metodo, headers=cabeceras or {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read()


def supabase(clave, ruta, cuerpo, metodo='POST', extra=None):
    cab = {'apikey': clave, 'Content-Type': 'application/json', **(extra or {})}
    return pedir(SUPABASE + ruta, metodo, json.dumps(cuerpo).encode(), cab)


def handler(event, context):
    meses = int((event or {}).get('meses', 3))
    clave = json.loads(boto3.client('secretsmanager').get_secret_value(SecretId=SECRETO)['SecretString'])[CAMPO_CLAVE]
    if (event or {}).get('firmar'):  # permisos de subida temporales (2 h) para rutas del bucket facturas
        return {p: json.loads(supabase(clave, '/storage/v1/object/upload/sign/facturas/' + p, {}, extra={'x-upsert': 'true'})[1])['url']
                for p in event['firmar']}
    cuenta = boto3.client('sts').get_caller_identity()['Account']
    inv = boto3.client('invoicing', region_name='us-east-1')
    try:
        hoy = datetime.date.today()
        y, m = hoy.year, hoy.month
        filas = []
        for _ in range(meses):
            r = inv.list_invoice_summaries(Selector={'ResourceType': 'ACCOUNT_ID', 'Value': cuenta},
                                           Filter={'BillingPeriod': {'Month': m, 'Year': y}}, MaxResults=100)
            for x in r.get('InvoiceSummaries', []):
                monto = x.get('PaymentCurrencyAmount') or x.get('BaseCurrencyAmount') or {}
                periodo = '%04d-%02d' % (x['BillingPeriod']['Year'], x['BillingPeriod']['Month'])
                archivo = 'aws/%s/%s.pdf' % (cuenta, x['InvoiceId'])
                pdf = inv.get_invoice_pdf(InvoiceId=x['InvoiceId'])['InvoicePDF']['DocumentUrl']
                _, contenido = pedir(pdf)
                pedir(SUPABASE + '/storage/v1/object/facturas/' + archivo, 'POST', contenido,
                      {'apikey': clave, 'x-upsert': 'true', 'Content-Type': 'application/pdf'})
                filas.append({'id': 'aws:' + x['InvoiceId'], 'proveedor': 'aws', 'cuenta': cuenta, 'numero': x['InvoiceId'],
                              'fecha': str(x['IssuedDate'])[:10], 'periodo': periodo,
                              'monto': float(monto['TotalAmount']) if monto.get('TotalAmount') else None,
                              'moneda': monto.get('CurrencyCode') or 'USD', 'archivo': archivo, 'correo_url': ''})
            m -= 1
            if m == 0:
                y, m = y - 1, 12
        if filas:
            supabase(clave, '/rest/v1/proveedor_factura?on_conflict=id', filas,
                     extra={'Prefer': 'resolution=merge-duplicates,return=minimal'})
        supabase(clave, '/rest/v1/rpc/registrar_carga', {'p_fuente': 'aws', 'p_filas': len(filas)})
        return {'facturas': len(filas), 'periodos': sorted({f['periodo'] for f in filas})}
    except Exception as e:
        supabase(clave, '/rest/v1/rpc/registrar_error', {'p_fuente': 'aws', 'p_mensaje': str(e)[:400]})
        raise
