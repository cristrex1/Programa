-- Ejecutar esto en Supabase: Panel izquierdo > SQL Editor > New query > pegar y correr

create table if not exists estado_sistema (
  id int primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table estado_sistema enable row level security;

-- Cualquier usuario que haya iniciado sesión (empleado) puede leer y escribir
create policy "Usuarios logueados pueden leer" on estado_sistema
  for select using (auth.role() = 'authenticated');

create policy "Usuarios logueados pueden escribir" on estado_sistema
  for insert with check (auth.role() = 'authenticated');

create policy "Usuarios logueados pueden actualizar" on estado_sistema
  for update using (auth.role() = 'authenticated');

-- Fila inicial vacía
insert into estado_sistema (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;
