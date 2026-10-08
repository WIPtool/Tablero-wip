# Secuencias de correo de Brevo

Fuente de verdad del texto, los tiempos y los enlaces de las dos secuencias del proceso comercial. Lo que se cambie en Brevo se actualiza aquí.

## Cómo funciona el proceso

```
WhatsApp (Meli consigue el correo) ─┐
Formulario o asesor (a mano) ───────┼─> lista "Info solicitada" (#9) ─> Pymes - Info solicitada (5 correos, 22 días)
                                     │                                        │ al terminar
                                     │                                        ▼
Base de prospectos ─────────────────┴──────────────────> lista "Nutricion - General" (#21) ─> Nutrición (10 correos, ~4 meses)
                                                                                                │ al terminar
                                                                                                ▼
                                                                         Boletín mensual (campaña a la lista #21)
```

- Kommo, oportunidad, campo **Secuencia Brevo**: Info solicitada, Nutrición o Desuscrito. **Reto**: lo que la persona contó por WhatsApp.
- Atributos de Brevo que usan los correos: `NOMBRE`, `NOMBRE_EMPRESA`, `RETO_PRINCIPAL` (frase en minúscula que completa "tu reto principal es ___").
- Los correos de Nutrición no usan `RETO_PRINCIPAL`, porque parte de esa lista viene de una base sin conversación previa.

## Enlaces (accionadores medidos, tablero.wiptool.com/links)

Cada correo tiene un código `c` propio para saber en el tablero qué correo generó el clic: `info-1` a `info-5` y `nut-1` a `nut-10`.

| Para qué | Enlace |
|---|---|
| Agendar la demo (botón principal) | `https://www.wiptool.com/agenda-email?c=<código>` |
| Hablar con un asesor por WhatsApp | `https://www.wiptool.com/wa-email?c=<código>` |
| Conocer WIP Equipos | `https://www.wiptool.com/equipos/email` |
| Ver planes y precios | `https://www.wiptool.com/planes/email` |
| Portada | `https://www.wiptool.com/email` |

Saludo con nombre opcional (si no hay nombre, queda "Hola 👋"):
`Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋`

Firma de todos: **Meli de WIP** · "La plataforma que usan los mejores prestando servicios en Latam 🔥" · "Hecho en Colombia, pensado para Latam 💛".

---

## 1. Pymes - Info solicitada

Disparador: contacto añadido a la lista "Info solicitada" (#9). Remitente: Meli de WIP. Al terminar: añadir a "Nutricion - General" (#21).

| # | Día | Asunto | Botón principal | Botón secundario |
|---|---|---|---|---|
| info-1 | 0 | La información que pediste de WIP 🚀 | Ver planes y precios (`/planes/email`) | Agendar mi demo (`agenda-email?c=info-1`) |
| info-2 | 3 | Así resolvió su operación una empresa como la tuya | Agendar mi demo (`agenda-email?c=info-2`) | Hablar con un asesor (`wa-email?c=info-2`) |
| info-3 | 8 | ¿Y si mi equipo no lo usa? | Agendar mi demo (`agenda-email?c=info-3`) | Hablar con un asesor (`wa-email?c=info-3`) |
| info-4 | 15 | Así se ve un lunes cuando ya no operas a ciegas | Quiero ver mi lunes así (`agenda-email?c=info-4`) | Hablar con un asesor (`wa-email?c=info-4`) |
| info-5 | 22 | ¿Tu colaborador ya llegó al servicio de hoy? | Hablar con un asesor (`wa-email?c=info-5`) | Agendar mi demo (`agenda-email?c=info-5`) |

### info-1 · día 0
**Asunto:** La información que pediste de WIP 🚀
**Vista previa:** Los planes y cómo resolvemos lo que nos contaste.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Como nos contaste, tu reto principal ahora mismo es {{ contact.RETO_PRINCIPAL }}. Por eso te dejo aquí la información de cómo lo resolvemos con WIP, junto con los planes mensuales.

Desde el primer día vas a tener:
✔️ Toda tu operación organizada y configurada a tu tipo de servicio.
✔️ La ubicación de tu equipo en tiempo real mientras presta los servicios.
✔️ Indicadores de tiempos y reportes al día.
✔️ Una experiencia digital para tus clientes por WhatsApp.

Todo apunta a una sola cosa: que {{ contact.RETO_PRINCIPAL }} deje de ser tu problema.

**[Ver planes y precios →]** `https://www.wiptool.com/planes/email`

Y si quieres ver la plataforma funcionando, agenda tu demo virtual: son unos 45 minutos donde te mostramos cómo se crean y se siguen los servicios, resolvemos tus dudas y vemos juntos si WIP es para tu empresa.

**[Agendar mi demo →]** `https://www.wiptool.com/agenda-email?c=info-1`

Cualquier duda, respóndeme este correo o escríbeme por WhatsApp: `https://www.wiptool.com/wa-email?c=info-1`

### info-2 · día 3
**Asunto:** Así resolvió su operación una empresa como la tuya
**Vista previa:** Un video corto de WIP en una operación real.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Mientras revisas la información con calma, quiero mostrarte cómo se ve WIP en la operación real de otra empresa que vivía lo mismo que tú: {{ contact.RETO_PRINCIPAL }}.

**[Ver el video →]** `https://youtube.com/shorts/wIwyzI-Ek3k`

Antes de WIP coordinaban servicio por servicio sin saber qué pasaba en la calle. Hoy resuelven en un turno lo que antes les tomaba el día entero. Y no es un caso aislado: ya son más de 4 millones de servicios gestionados en Latam con empresas que tenían estos mismos retos.

Aquí tienes otro caso, el de Fixit: `https://forbes.co/emprendedores/esta-insurtech-colombiana-se-esta-expandiendo-a-centroamerica-y-estados-unidos-con-su-asistencia-sin-polizas`

¿Quieres verlo con tu propia operación?

**[Agendar mi demo →]** `https://www.wiptool.com/agenda-email?c=info-2`
**[Prefiero hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=info-2`

### info-3 · día 8
**Asunto:** ¿Y si mi equipo no lo usa?
**Vista previa:** La pregunta que casi todos nos hacen en este punto.

Es la pregunta que casi todos nos hacen en este punto, así que te la respondo directo: que tu equipo use WIP no depende de que "aprenda un software nuevo". Depende de que sea más fácil que lo que hacen hoy, y de que no te dejemos solo con la implementación.

Por eso:
✔️ La app es simple para quien está en la calle y para quien coordina desde la oficina.
✔️ La configuración, el acompañamiento y la capacitación de tu equipo van incluidos.
✔️ Nuestros clientes tienen a su equipo operando en días, no en semanas.

Si quieres ver cómo sería ese acompañamiento con tu operación, agenda tu demo:

**[Agendar mi demo →]** `https://www.wiptool.com/agenda-email?c=info-3`
**[Prefiero hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=info-3`

### info-4 · día 15
**Asunto:** Así se ve un lunes cuando ya no operas a ciegas
**Vista previa:** Sin preguntar por WhatsApp, sin llamar a nadie.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Imagina esto: abres el celular un lunes en la mañana y ya sabes, sin preguntar por WhatsApp y sin llamar a nadie, cuántos servicios están en curso, cuáles van atrasados y qué necesita tu equipo antes de que el cliente se queje.

No es una idea lejana. Es lo que pasa cuando resuelves {{ contact.RETO_PRINCIPAL }}: dejas de operar reaccionando y empiezas a operar con control.

**[Quiero ver mi lunes así →]** `https://www.wiptool.com/agenda-email?c=info-4`
**[Prefiero hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=info-4`

### info-5 · día 22
**Asunto:** ¿Tu colaborador ya llegó al servicio de hoy?
**Vista previa:** Haz la cuenta de cuántas veces lo preguntas al día.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Haz la cuenta: ¿cuántas veces al día preguntas "¿ya llegaste donde el cliente?", "¿cuánto te demoras?" o "¿me mandas las fotos del servicio al grupo?"

Cada una de esas preguntas es tiempo que no vuelve, y {{ contact.RETO_PRINCIPAL }} sigue ahí mientras lo dejas pasar. Resolverlo no toma meses ni te obliga a cambiar cómo trabajas.

Si quieres, escríbeme y lo vemos con tu caso:

**[Hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=info-5`
**[Agendar mi demo →]** `https://www.wiptool.com/agenda-email?c=info-5`

De aquí en adelante te voy a escribir cada par de semanas con ideas para tu operación. Si en algún momento no quieres recibirlas, puedes darte de baja abajo.

---

## 2. Nutrición - WIP Equipos

Disparador: contacto añadido a la lista "Nutricion - General" (#21). Remitente: Meli de WIP. Duración: unos 4 meses. Al terminar, la persona sigue en la lista #21 y recibe el boletín mensual.

| # | Espera antes | Día | Asunto | Botón principal | Botón secundario |
|---|---|---|---|---|---|
| nut-1 | 0 | 0 | Excel, WhatsApp y llamadas: así se ve una operación a ciegas | Conocer WIP (`/equipos/email`) | Agendar una demo (`agenda-email?c=nut-1`) |
| nut-2 | 7 días | 7 | Deja de llamar a tu equipo para saber "cómo va" el servicio | Agendar una demo (`agenda-email?c=nut-2`) | Hablar con un asesor (`wa-email?c=nut-2`) |
| nut-3 | 10 días | 17 | Asignación inteligente de servicios a tu equipo 🚀 | Agendar una demo (`agenda-email?c=nut-3`) | Hablar con un asesor (`wa-email?c=nut-3`) |
| nut-4 | 10 días | 27 | Que tu equipo sepa qué cobrar, sin hacer cuentas | Agendar una demo (`agenda-email?c=nut-4`) | Hablar con un asesor (`wa-email?c=nut-4`) |
| nut-5 | 12 días | 39 | Reportes que se arman solos | Agendar una demo (`agenda-email?c=nut-5`) | Hablar con un asesor (`wa-email?c=nut-5`) |
| nut-6 | 12 días | 51 | Tu cliente ya no pregunta "¿a qué hora llegan?" | Agendar una demo (`agenda-email?c=nut-6`) | Hablar con un asesor (`wa-email?c=nut-6`) |
| nut-7 | 14 días | 65 | Fotos, firmas y formularios: el servicio se cierra en el sitio | Agendar una demo (`agenda-email?c=nut-7`) | Hablar con un asesor (`wa-email?c=nut-7`) |
| nut-8 | 14 días | 79 | Implementar WIP toma días, no meses | Agendar una demo (`agenda-email?c=nut-8`) | Hablar con un asesor (`wa-email?c=nut-8`) |
| nut-9 | 14 días | 93 | ¿Cuánto cuesta WIP para una operación como la tuya? | Ver planes (`/planes/email`) | Agendar una demo (`agenda-email?c=nut-9`) |
| nut-10 | 21 días | 114 | ¿Te sigo escribiendo? | Sí, quiero ver WIP (`agenda-email?c=nut-10`) | Hablar con un asesor (`wa-email?c=nut-10`) |

### nut-1 · día 0
**Asunto:** Excel, WhatsApp y llamadas: así se ve una operación a ciegas
**Vista previa:** Las tres herramientas que usan casi todas las empresas de servicios.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Casi todas las empresas que prestan servicios en sitio en Latam los coordinan con las mismas tres herramientas: Excel, WhatsApp y llamadas.

No está mal, pero es operar a ciegas: la información queda repartida en chats, en hojas que alguien actualiza tarde y en llamadas para "confirmar cómo va el servicio". Nadie tiene la foto completa en tiempo real y las decisiones se toman con datos de ayer.

En las próximas semanas te voy a mostrar, una pieza a la vez, cómo se ve una operación cuando eso se vuelve digital y visible: cómo se monitorea, cómo se asigna, cómo se cobra, cómo se reporta y cómo lo vive tu cliente final.

**[Conocer WIP →]** `https://www.wiptool.com/equipos/email`
**[Agendar una demo →]** `https://www.wiptool.com/agenda-email?c=nut-1`

### nut-2 · día 7
**Asunto:** Deja de llamar a tu equipo para saber "cómo va" el servicio
**Vista previa:** La Central de Monitoreo de WIP, en una sola pantalla.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Si tuviera que elegir una sola cosa que cambia la operación, sería la Central de Monitoreo de WIP. En una sola pantalla ves, en tiempo real, lo que pasa con cada servicio:

✔️ Tiempos de llegada y recorridos de cada colaborador.
✔️ Fotos y evidencias de lo que se hizo, sin pedirlas por WhatsApp.
✔️ El chat del equipo por servicio, no en un grupo caótico.
✔️ El estado de cada servicio de un vistazo: a tiempo, en riesgo o cerrado.

El servicio prioritario que hoy descubres frenado a media tarde, aquí salta solo. Y el "¿cómo va?" deja de resolverse con una llamada, porque la respuesta ya está en pantalla.

**[Verlo en una demo →]** `https://www.wiptool.com/agenda-email?c=nut-2`
**[Hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=nut-2`

En el próximo correo: cómo llega el servicio correcto a la persona correcta, sin depender de la memoria de nadie.

### nut-3 · día 17
**Asunto:** Asignación inteligente de servicios a tu equipo 🚀
**Vista previa:** El coordinador deja de ser operador telefónico.

Cuando la asignación se hace por WhatsApp o "por lo que alguien recuerda", siempre pasa lo mismo: servicios que caen en la persona equivocada, otros que se quedan sin asignar y un coordinador que se gasta el día repartiendo trabajo a mano.

Con WIP, la asignación inteligente reparte los servicios entre tu equipo considerando quién está disponible, quién está más cerca y la prioridad de cada uno. El servicio llega a quien corresponde, con toda la información que necesita, directo a su celular.

El coordinador deja de ser operador telefónico y vuelve a lo suyo: hacer crecer la operación, no perseguirla.

**[Verlo en una demo →]** `https://www.wiptool.com/agenda-email?c=nut-3`
**[Hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=nut-3`

En el próximo correo: que tu equipo sepa siempre qué cobrar, sin calcular nada a mano.

### nut-4 · día 27 (nuevo)
**Asunto:** Que tu equipo sepa qué cobrar, sin hacer cuentas
**Vista previa:** Tarifas automáticas por cada servicio.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

¿Cuánto tiempo se va al final del mes cuadrando qué se cobró, qué faltó y cuánto le toca a cada quien? Cuando las tarifas viven en la cabeza de alguien o en un Excel, cada servicio es una cuenta a mano y cada cuenta es un posible error.

En WIP configuras tus tarifas una vez, según las reglas de tu operación. Desde ahí, cada servicio se calcula solo apenas se cierra, y tienes el total del día o del mes sin perseguir a nadie.

Menos discusiones con clientes y colaboradores, y cierres de mes en minutos.

**[Verlo en una demo →]** `https://www.wiptool.com/agenda-email?c=nut-4`
**[Hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=nut-4`

En el próximo correo: los reportes que hoy armas a mano, listos solos.

### nut-5 · día 39 (nuevo)
**Asunto:** Reportes que se arman solos
**Vista previa:** Decide con los datos de hoy, no con los de la semana pasada.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Si para saber cómo le fue a tu operación tienes que juntar chats, fotos y hojas de cálculo, el reporte siempre llega tarde, y con él, las decisiones.

En WIP cada servicio deja su rastro solo: a qué hora se asignó, cuánto tardó en llegar, cuánto duró y cómo se cerró. Con eso tienes, sin armar nada:

✔️ Tiempos de llegada y de atención por colaborador y por zona.
✔️ Servicios cumplidos, atrasados y cancelados.
✔️ Reportes para compartir con tus clientes cuando te los pidan.

Así sabes dónde se está perdiendo el tiempo y quién está sacando la operación adelante.

**[Verlo en una demo →]** `https://www.wiptool.com/agenda-email?c=nut-5`
**[Hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=nut-5`

En el próximo correo: cómo vive todo esto tu cliente final.

### nut-6 · día 51 (nuevo)
**Asunto:** Tu cliente ya no pregunta "¿a qué hora llegan?"
**Vista previa:** La experiencia de una app, sin que tu cliente descargue nada.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

La llamada que más se repite en una empresa de servicios es la del cliente preguntando "¿a qué hora llegan?". Y cada una interrumpe a alguien de tu equipo.

Con WIP, tu cliente recibe por WhatsApp cada paso de su servicio: quién va, a cuánto está y cuándo llegó. Al final puede calificar la atención. Todo sin descargar ninguna app.

Tu marca se ve más profesional, tu equipo recibe menos llamadas y tú sabes, servicio por servicio, qué tan contentos quedan tus clientes.

**[Verlo en una demo →]** `https://www.wiptool.com/agenda-email?c=nut-6`
**[Hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=nut-6`

### nut-7 · día 65 (nuevo)
**Asunto:** Fotos, firmas y formularios: el servicio se cierra en el sitio
**Vista previa:** Adiós a las fotos perdidas en el grupo de WhatsApp.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

¿Cuántas veces has tenido que buscar en el grupo de WhatsApp la foto de un servicio que un cliente está reclamando?

En WIP, tu colaborador cierra cada servicio desde la app con lo que tú definas: fotos, firma del cliente, observaciones y formularios propios para tu tipo de servicio. Todo queda guardado en el servicio, con hora y ubicación, listo para cuando lo necesites.

Si hay un reclamo, la evidencia está a un clic. Y si un cliente pide el soporte, se lo mandas en segundos.

**[Verlo en una demo →]** `https://www.wiptool.com/agenda-email?c=nut-7`
**[Hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=nut-7`

### nut-8 · día 79 (nuevo)
**Asunto:** Implementar WIP toma días, no meses
**Vista previa:** Configuración, acompañamiento y capacitación incluidos.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Cambiar de herramienta da pereza, y es normal: nadie quiere frenar la operación para "implementar un sistema".

Por eso en WIP la implementación funciona así:
✔️ Configuramos contigo WIP según cómo opera tu empresa: tus servicios, estados, formularios y tarifas.
✔️ Capacitamos a tu equipo de oficina y a tus colaboradores en campo.
✔️ Todo eso va incluido en el plan, sin costo de arranque.
✔️ Sin cláusulas de permanencia: puedes cambiar de plan o cancelar cuando quieras.

La mayoría de nuestros clientes está operando en WIP en pocos días.

**[Agendar una demo →]** `https://www.wiptool.com/agenda-email?c=nut-8`
**[Hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=nut-8`

### nut-9 · día 93 (nuevo)
**Asunto:** ¿Cuánto cuesta WIP para una operación como la tuya?
**Vista previa:** Planes mensuales según los servicios que haces al mes.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Es la pregunta que más nos hacen, así que te la respondo sin rodeos: WIP funciona con planes mensuales según la cantidad de servicios que registras al mes, no por número de usuarios.

Hay planes desde 200 servicios al mes, y si un mes te pasas del cupo, nada se bloquea: el servicio adicional se cobra aparte. Con pago anual tienes 10% de descuento, y en todos los planes van incluidas la configuración y la capacitación.

Puedes ver los planes y precios en tu moneda aquí:

**[Ver planes y precios →]** `https://www.wiptool.com/planes/email`
**[Agendar una demo →]** `https://www.wiptool.com/agenda-email?c=nut-9`

Si manejas más de 1.200 servicios al mes o coordinas una red de proveedores, escríbeme y armamos una propuesta a tu medida: `https://www.wiptool.com/wa-email?c=nut-9`

### nut-10 · día 114 (nuevo)
**Asunto:** ¿Te sigo escribiendo?
**Vista previa:** Una pregunta rápida antes de seguir.

Hola{% if contact.NOMBRE %} {{ contact.NOMBRE }}{% endif %} 👋

Llevamos unos meses compartiéndote ideas para tener tu operación en tiempo real, y quiero preguntarte algo rápido: ¿te sigue sirviendo?

Si este es buen momento para organizar tu operación, agenda tu demo y lo vemos con tu caso:

**[Sí, quiero ver WIP →]** `https://www.wiptool.com/agenda-email?c=nut-10`
**[Prefiero hablar con un asesor →]** `https://www.wiptool.com/wa-email?c=nut-10`

Si no es el momento, no pasa nada: te seguiré enviando una vez al mes las novedades de WIP. Y si prefieres no recibir más correos, puedes darte de baja abajo.

---

## 3. Boletín mensual

Campaña (no automatización) a la lista "Nutricion - General" (#21), excluyendo a quien esté todavía en la secuencia de Nutrición. Un correo al mes con: una novedad de WIP, un caso o dato de la operación de servicios y un tip, con el botón de agendar demo (`agenda-email?c=boletin-<mes>`).

## 4. Reglas de salida y limpieza (pendientes)

- Quien agenda la demo (Calendly) sale de las secuencias y pasa a "Demo solicitada".
- Quien hace clic en "Agendar" o "Hablar con un asesor" queda marcado en Kommo para que un asesor le escriba.
- Quien no abre nada en 90 días recibe un correo de "¿sigues interesado?" y, si no responde, sale de la lista para cuidar la entregabilidad.
- Brevo avisa a Kommo cuando la persona pasa a Nutrición o se da de baja (campo Secuencia Brevo).
