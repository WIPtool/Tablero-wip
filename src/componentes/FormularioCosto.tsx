'use client';

import { useActionState, useRef, useEffect } from 'react';
import { agregarCosto, agregarGasto, agregarPago, type Resultado } from '@/app/(tablero)/costos/acciones';

const campo = 'rounded-lg border border-linea bg-superficie px-2.5 py-1.5 text-tinta';
const etiqueta = 'flex flex-col gap-1 text-[12.5px] text-suave';
type Accion = (previo: Resultado | null, datos: FormData) => Promise<Resultado>;

function Formulario({ accion, boton, children }: { accion: Accion; boton: string; children: React.ReactNode }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(accion, null);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado?.ok) formulario.current?.reset(); }, [estado]);
  return (
    <form ref={formulario} action={enviar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {children}
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
        <button type="submit" disabled={enviando}
          className="rounded-full bg-tinta px-4 py-2 font-semibold text-fondo transition hover:opacity-90 disabled:opacity-60">
          {enviando ? 'Guardando…' : boton}
        </button>
        {estado && <span role="status" className={`text-[12.5px] ${estado.ok ? 'text-bueno' : 'text-malo'}`}>{estado.mensaje}</span>}
      </div>
    </form>
  );
}

const Moneda = ({ id, porDefecto = 'USD' }: { id: string; porDefecto?: 'USD' | 'COP' }) => (
  <label className={etiqueta}>
    Moneda
    <select name="moneda" id={id} defaultValue={porDefecto} className={campo}>
      <option value="USD">Dólares (USD)</option>
      <option value="COP">Pesos (COP)</option>
    </select>
  </label>
);

const Plataformas = ({ id, plataformas }: { id: string; plataformas: string[] }) => (
  <label className={`${etiqueta} lg:col-span-2`}>
    Plataforma
    <input name="plataforma" id={id} required list={`${id}-lista`} placeholder="Ej.: Meta Ads" className={campo} />
    <datalist id={`${id}-lista`}>{plataformas.map((p) => <option key={p} value={p} />)}</datalist>
  </label>
);

// Suscripción o herramienta nueva.
export function FormularioCosto({ hoy, categorias }: { hoy: string; categorias: string[] }) {
  return (
    <Formulario accion={agregarCosto} boton="Agregar">
      <label className={`${etiqueta} lg:col-span-2`}>
        Plataforma o suscripción
        <input name="plataforma" id="plataforma" required placeholder="Ej.: Kommo, n8n, Canva" className={campo} />
      </label>
      <label className={`${etiqueta} lg:col-span-2`}>
        Categoría
        <input name="categoria" id="categoria" list="categorias-costo" placeholder="Herramientas de marketing" className={campo} />
        <datalist id="categorias-costo">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label className={`${etiqueta} lg:col-span-2`}>
        Para qué sirve
        <input name="para_que" id="para_que" placeholder="Ej.: correos de nutrición" className={campo} />
      </label>
      <label className={etiqueta}>
        Licencia mensual
        <input name="monto" id="monto" required inputMode="decimal" placeholder="17" className={`${campo} tabular-nums`} />
      </label>
      <Moneda id="moneda-costo" />
      <label className={etiqueta}>
        Cobro
        <select name="cobro" id="cobro" defaultValue="mensual" className={campo}>
          <option value="mensual">Mensual</option>
          <option value="anual">Anual (valor mensual)</option>
          <option value="prepago">Prepago (recargas)</option>
          <option value="consumo">Por consumo</option>
          <option value="gratis">Gratis</option>
        </select>
      </label>
      <label className={etiqueta}>
        Estado
        <select name="estado" id="estado-costo" defaultValue="activo" className={campo}>
          <option value="activo">Activo</option>
          <option value="prueba">En prueba</option>
          <option value="suspendido">Suspendido</option>
          <option value="por_confirmar">Por confirmar</option>
        </select>
      </label>
      <label className={etiqueta}>
        Activo desde
        <input name="desde" id="desde-costo" type="date" required defaultValue={hoy} className={campo} />
      </label>
      <label className={etiqueta}>
        Próximo pago
        <input name="proximo_pago" id="proximo-costo" type="date" className={campo} />
      </label>
      <label className={`${etiqueta} lg:col-span-2`}>
        Método de pago
        <input name="metodo_pago" id="metodo-costo" placeholder="Ej.: Mastercard •••• 5177" className={campo} />
      </label>
      <label className={etiqueta}>
        Hasta (vacío si sigue)
        <input name="hasta" id="hasta-costo" type="date" className={campo} />
      </label>
      <label className={`${etiqueta} sm:col-span-2 lg:col-span-3`}>
        Nota
        <input name="nota" id="nota" placeholder="Ej.: plan Starter, 10.000 correos" className={campo} />
      </label>
    </Formulario>
  );
}

// Consumo o cargo puntual (Claude API, WhatsApp Business, recargas).
export function FormularioGasto({ hoy, plataformas }: { hoy: string; plataformas: string[] }) {
  return (
    <Formulario accion={agregarGasto} boton="Registrar gasto">
      <Plataformas id="plataforma-gasto" plataformas={plataformas} />
      <label className={etiqueta}>
        Valor
        <input name="monto" id="monto-gasto" required inputMode="decimal" placeholder="16,17" className={`${campo} tabular-nums`} />
      </label>
      <Moneda id="moneda-gasto" />
      <label className={etiqueta}>
        Fecha
        <input name="fecha" id="fecha-gasto" type="date" required defaultValue={hoy} className={campo} />
      </label>
      <label className={etiqueta}>
        ¿Es de marketing?
        <select name="suma_inversion" id="suma-gasto" defaultValue="si" className={campo}>
          <option value="si">Sí, suma a la inversión</option>
          <option value="no">No (operación de la plataforma)</option>
        </select>
      </label>
      <label className={`${etiqueta} sm:col-span-2 lg:col-span-6`}>
        Concepto
        <input name="concepto" id="concepto-gasto" placeholder="Ej.: consumo del 1 al 31 de octubre" className={campo} />
      </label>
    </Formulario>
  );
}

// Pago o cobro de la tarjeta (Meta Ads y demás).
export function FormularioPago({ hoy, plataformas }: { hoy: string; plataformas: string[] }) {
  return (
    <Formulario accion={agregarPago} boton="Registrar pago">
      <Plataformas id="plataforma-pago" plataformas={plataformas} />
      <label className={etiqueta}>
        Valor
        <input name="monto" id="monto-pago" required inputMode="decimal" placeholder="455.038" className={`${campo} tabular-nums`} />
      </label>
      <Moneda id="moneda-pago" porDefecto="COP" />
      <label className={etiqueta}>
        Fecha
        <input name="fecha" id="fecha-pago" type="date" required defaultValue={hoy} className={campo} />
      </label>
      <label className={etiqueta}>
        Estado
        <select name="estado" id="estado-pago" defaultValue="pagado" className={campo}>
          <option value="pagado">Pagado</option>
          <option value="pendiente">Pendiente</option>
          <option value="fallido">Falló</option>
        </select>
      </label>
      <label className={`${etiqueta} lg:col-span-2`}>
        Referencia
        <input name="referencia" id="referencia-pago" placeholder="Ej.: número de transacción" className={campo} />
      </label>
      <label className={`${etiqueta} sm:col-span-2 lg:col-span-4`}>
        Nota
        <input name="nota" id="nota-pago" placeholder="Ej.: Mastercard •••• 5177" className={campo} />
      </label>
    </Formulario>
  );
}
