// Mientras llegan los datos del servidor: esqueleto con la forma de la página.
export default function Cargando() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando datos">
      <div className="h-14 w-72 max-w-full cargando" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] rounded-tarjeta cargando" />)}
      </div>
      <div className="h-80 rounded-tarjeta cargando" />
    </div>
  );
}
