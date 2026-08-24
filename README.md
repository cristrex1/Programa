# Sistema de gestión — puesta en marcha

Este proyecto es el sistema (Stock, Reparaciones, Agenda, Facturación) armado como página web propia, con login y datos compartidos entre empleados usando Supabase.

## 1) Crear la base de datos (Supabase)

1. Entrá a https://supabase.com y creá una cuenta gratis.
2. Creá un proyecto nuevo (elegí una contraseña de base de datos y guardala).
3. En el panel del proyecto, andá a **SQL Editor** → **New query**, pegá el contenido del archivo `supabase-schema.sql` y ejecutalo. Esto crea la tabla donde vive toda la información del sistema.
4. Andá a **Project Settings → API**. Copiá:
   - **Project URL**
   - **anon public key**

## 2) Crear los usuarios (vos y tus empleados)

1. En Supabase, andá a **Authentication → Users → Add user**.
2. Cargá el email y una contraseña para cada persona que va a usar el sistema (vos incluido).
3. No hace falta pantalla de registro pública: los usuarios se crean siempre desde acá, así solo entra quien vos autorizás.

## 3) Configurar el proyecto

1. Necesitás tener [Node.js](https://nodejs.org) instalado en tu computadora.
2. Abrí una terminal dentro de esta carpeta y ejecutá:
   ```
   npm install
   ```
3. Copiá el archivo `.env.example` y renombralo a `.env`. Completá los dos valores con los que copiaste en el paso 1:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon
   ```
4. Para probarlo en tu computadora:
   ```
   npm run dev
   ```
   Se abre en `http://localhost:5173`. Entrá con el email/contraseña que creaste en el paso 2.

## 4) Publicarlo en internet (Vercel)

1. Subí esta carpeta a un repositorio de GitHub (podés arrastrar los archivos desde github.com/new si no usás git).
2. Entrá a https://vercel.com, creá una cuenta gratis y elegí **Add New → Project**, conectando ese repositorio.
3. En **Environment Variables**, cargá las mismas dos variables del paso 3 (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
4. Hacé clic en **Deploy**. En un par de minutos te da una dirección tipo `tu-sistema.vercel.app`, ya funcionando en internet.
5. Si querés tu propio dominio (ej. `tunegocio.com.ar`), lo comprás donde prefieras y lo conectás desde **Project Settings → Domains** en Vercel.

## Notas importantes

- Todos los usuarios logueados comparten los mismos datos (es un solo negocio, no hay separación por usuario).
- Si dos personas guardan un cambio al mismo tiempo, gana el último guardado (no hay fusión automática todavía). Para un local con pocos empleados normalmente no es un problema, pero es bueno saberlo.
- La facturación electrónica ante AFIP sigue sin conectar — eso se agrega en un paso aparte cuando tengas el certificado digital y el punto de venta habilitados.
