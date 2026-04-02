-- Script para crear un usuario administrador en FondosEG
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Asegurarse de que pgcrypto esté habilitado para el hash de contraseñas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Variables del nuevo administrador (Puedes cambiar estos valores)
DO $$
DECLARE
  new_user_id UUID := uuid_generate_v4();
  user_email TEXT := 'aesono@segesa.gq';
  user_password TEXT := 'Admin1234@'; -- Cambia esta contraseña inmediatamente después del primer login
  user_name TEXT := 'Administrador Principal';
  user_phone TEXT := '+240555877465'; -- Debe ser único en la tabla public.users
BEGIN
  -- Verificar si el usuario ya existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    RAISE NOTICE 'El usuario con email % ya existe.', user_email;
  ELSE
    -- Insertar en auth.users (Supabase Auth)
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      user_email,
      crypt(user_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'name', user_name,
        'phone', user_phone,
        'role', 'admin'
      ),
      now(),
      now(),
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );

    -- Nota: El trigger 'on_auth_user_created' en schema.sql 
    -- insertará automáticamente en public.users basándose en los metadatos anteriores.

    RAISE NOTICE 'Usuario administrador creado con éxito: %', user_email;
  END IF;
END $$;
