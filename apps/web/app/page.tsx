'use client';

import { useEffect, useState } from 'react';

interface HealthData {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  services: {
    api: string;
    database: string;
  };
  version: string;
}

export default function HomePage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const healthEndpoint = `${apiBaseUrl}/api/health`;

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const res = await fetch(healthEndpoint, { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al conectar con la API';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-10 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-950/40 px-3 py-1 text-xs font-medium text-sky-300 mb-4">
          <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          Cimientos de Arquitectura • Portafolio
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
          Sistema de Reservas y Recordatorios
        </h1>
        <p className="mt-2 text-base text-slate-400 max-w-2xl">
          Estructura base multiempresa para pequeños negocios (peluquerías, kinesiólogos, talleres).
          Aislamiento garantizado con <code className="text-sky-300 font-mono">empresa_id</code> en cada modelo.
        </p>
      </header>

      {/* Grid de Monitoreo */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Tarjeta de Healthcheck */}
        <section className="col-span-2 rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-white">Estado del Backend</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                GET {healthEndpoint}
              </p>
            </div>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Consultando...
                </>
              ) : (
                'Actualizar'
              )}
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {loading && !data && (
              <div className="py-8 text-center text-slate-400 text-sm">
                Conectando con el endpoint de salud...
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-4 text-rose-300">
                <div className="flex items-center gap-2 font-medium">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  No se pudo contactar a la API
                </div>
                <p className="mt-1 text-xs text-rose-400">{error}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Verifica que el contenedor de Docker esté activo y que la API se esté ejecutando en el puerto 4000 (<code className="text-slate-300">pnpm dev:api</code>).
                </p>
              </div>
            )}

            {data && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
                    <span className="text-xs text-slate-400">Estado Global</span>
                    <p className="mt-1 flex items-center gap-1.5 font-semibold text-emerald-400 text-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      {data.status.toUpperCase()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
                    <span className="text-xs text-slate-400">Servicio API</span>
                    <p className="mt-1 font-semibold text-slate-200 text-sm capitalize">
                      {data.services.api}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
                    <span className="text-xs text-slate-400">Base de Datos</span>
                    <p className={`mt-1 font-semibold text-sm capitalize ${data.services.database === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {data.services.database}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
                    <span className="text-xs text-slate-400">Latencia</span>
                    <p className="mt-1 font-semibold text-sky-400 text-sm">
                      {latency !== null ? `${latency} ms` : '-'}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Respuesta JSON Cruda</div>
                  <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Resumen del Stack y Cimientos */}
        <aside className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Tablas Base (Drizzle ORM)
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                <code className="font-mono text-sky-200">empresas</code> (Root Tenant)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                <code className="font-mono text-sky-200">servicios</code> (<span className="text-sky-400 font-mono">empresa_id</span>)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                <code className="font-mono text-sky-200">profesionales</code> (<span className="text-sky-400 font-mono">empresa_id</span>)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                <code className="font-mono text-sky-200">horarios</code> (<span className="text-sky-400 font-mono">empresa_id</span>)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                <code className="font-mono text-sky-200">reservas</code> (<span className="text-sky-400 font-mono">empresa_id</span>)
              </li>
            </ul>

            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mt-6 mb-3">
              Fases Posteriores
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sin WhatsApp ni pasarelas de pago por diseño en esta fase de cimientos. Se incorporarán al madurar el dominio del negocio.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400">
            Stack: NestJS 12 ESM • Next.js 16 • React 19 • Tailwind 4 • PostgreSQL 17
          </div>
        </aside>
      </div>
    </main>
  );
}
